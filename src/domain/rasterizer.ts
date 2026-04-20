import bwipjs from 'bwip-js'

import { mmToPx } from './constants'
import type { CodeElement, LabelElement, LineElement, TextElement } from './types'
import { normalizeGS1 } from './utils'

export const applyThreshold = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) {
      data[i + 3] = 0
      continue
    }

    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
    if (brightness < 128) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 255
    } else {
      data[i + 3] = 0
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

const toPx = (mm: number, pxPerMm: number): number => {
  return mmToPx(mm, pxPerMm)
}

const scaleTextElement = (element: TextElement, pxPerMm: number) => {
  return {
    width: toPx(element.width, pxPerMm),
    height: toPx(element.height, pxPerMm),
    fontSize: Math.max(1, toPx(element.fontSize, pxPerMm)),
    align: element.align,
    bold: element.bold,
  }
}

const scaleCodeElement = (element: CodeElement, pxPerMm: number) => {
  return {
    width: toPx(element.width, pxPerMm),
    height: toPx(element.height, pxPerMm),
    codeType: element.codeType,
    scaleMode: element.scaleMode,
  }
}

const scaleLineElement = (element: LineElement, pxPerMm: number) => {
  return {
    x1: toPx(element.x1, pxPerMm),
    y1: toPx(element.y1, pxPerMm),
    x2: toPx(element.x2, pxPerMm),
    y2: toPx(element.y2, pxPerMm),
    thickness: Math.max(1, toPx(element.thickness, pxPerMm)),
  }
}

export const renderSystemText = (
  element: { width: number; height: number; fontSize: number; align: 'left' | 'center' | 'right'; bold: boolean },
  text: string,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = element.width
  canvas.height = element.height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return canvas
  }

  ctx.fillStyle = 'black'
  ctx.font = `${element.bold ? 'bold' : 'normal'} ${element.fontSize}px Arial, sans-serif`
  ctx.textBaseline = 'top'

  const lines = String(text).split('\n')
  const wrapped: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const words = lines[i].split(' ')
    let current = ''

    for (let w = 0; w < words.length; w += 1) {
      const word = words[w]
      const candidate = `${current}${current ? ' ' : ''}${word}`
      if (ctx.measureText(candidate).width > element.width && current !== '') {
        wrapped.push(current)
        current = word
      } else {
        current = candidate
      }
    }

    if (current) {
      wrapped.push(current)
    }
  }

  let y = 0
  for (let i = 0; i < wrapped.length; i += 1) {
    const line = wrapped[i]
    const lineWidth = ctx.measureText(line).width
    let x = 0

    if (element.align === 'center') {
      x = Math.floor((element.width - lineWidth) / 2)
    }

    if (element.align === 'right') {
      x = element.width - lineWidth
    }

    ctx.fillText(line, x, y)
    y += element.fontSize + 2
  }

  applyThreshold(canvas)
  return canvas
}

export const renderBarcode = (
  element: { width: number; height: number; codeType: string; scaleMode: 'integer' | 'stretch' },
  value: string,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = element.width
  canvas.height = element.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return canvas
  }

  try {
    const sourceCanvas = document.createElement('canvas')
    const normalizedValue = normalizeGS1(value)
    const isTwoDimensional = ['gs1datamatrix', 'datamatrix', 'qrcode', 'gs1qrcode'].includes(element.codeType)

    bwipjs.toCanvas(sourceCanvas, {
      bcid: element.codeType,
      text: normalizedValue,
      scale: 1,
      includetext: !isTwoDimensional,
    })

    let drawWidth: number
    let drawHeight: number

    if (element.scaleMode === 'stretch') {
      if (isTwoDimensional) {
        const factor = Math.min(element.width / sourceCanvas.width, element.height / sourceCanvas.height)
        drawWidth = sourceCanvas.width * factor
        drawHeight = sourceCanvas.height * factor
      } else {
        drawWidth = element.width
        drawHeight = element.height
      }
    } else if (isTwoDimensional) {
      const scale = Math.max(
        1,
        Math.min(
          Math.floor(element.width / sourceCanvas.width),
          Math.floor(element.height / sourceCanvas.height),
        ),
      )
      drawWidth = sourceCanvas.width * scale
      drawHeight = sourceCanvas.height * scale
    } else {
      const scaleX = Math.max(1, Math.floor(element.width / sourceCanvas.width))
      drawWidth = sourceCanvas.width * scaleX
      drawHeight = element.height
    }

    const offsetX = Math.floor((element.width - drawWidth) / 2)
    const offsetY = Math.floor((element.height - drawHeight) / 2)

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, offsetX, offsetY, drawWidth, drawHeight)

    if (element.scaleMode === 'stretch') {
      applyThreshold(canvas)
    }
  } catch {
    // Ignore render failures for unsupported payloads and keep empty canvas.
  }

  return canvas
}

export const renderLine = (
  element: { x1: number; y1: number; x2: number; y2: number; thickness: number },
  boxWidth: number,
  boxHeight: number,
  boxX: number,
  boxY: number,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = boxWidth
  canvas.height = boxHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return canvas
  }

  ctx.strokeStyle = 'black'
  ctx.lineWidth = element.thickness || 1
  ctx.lineCap = 'square'
  ctx.beginPath()
  ctx.moveTo(element.x1 - boxX, element.y1 - boxY)
  ctx.lineTo(element.x2 - boxX, element.y2 - boxY)
  ctx.stroke()
  applyThreshold(canvas)

  return canvas
}

export const renderImage = (element: { width: number; height: number }, src: string): Promise<HTMLCanvasElement> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = element.width
    canvas.height = element.height

    if (!src) {
      resolve(canvas)
      return
    }

    const image = new Image()
    image.onload = () => {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(image, 0, 0, element.width, element.height)
      }
      resolve(canvas)
    }

    image.onerror = () => {
      resolve(canvas)
    }

    image.src = src
  })
}

export const renderElement = async (
  element: LabelElement,
  value: string,
  pxPerMm: number,
): Promise<HTMLCanvasElement | null> => {
  if (element.type === 'line') {
    const scaled = scaleLineElement(element, pxPerMm)
    const pad = scaled.thickness || 1
    const boxX = Math.min(scaled.x1, scaled.x2) - pad
    const boxY = Math.min(scaled.y1, scaled.y2) - pad
    const boxW = Math.abs(scaled.x2 - scaled.x1) + pad * 2
    const boxH = Math.abs(scaled.y2 - scaled.y1) + pad * 2
    return renderLine(scaled, boxW, boxH, boxX, boxY)
  }

  if (element.type === 'text') {
    return renderSystemText(scaleTextElement(element, pxPerMm), value)
  }

  if (element.type === 'code') {
    return renderBarcode(scaleCodeElement(element, pxPerMm), value)
  }

  if (element.type === 'image') {
    return renderImage(
      {
        width: toPx(element.width, pxPerMm),
        height: toPx(element.height, pxPerMm),
      },
      value,
    )
  }

  return null
}
