import bwipjs from 'bwip-js'

import { THERMAL_FONT } from './thermal-font'
import type { CodeElement, LabelElement, LineElement, TextElement, ThermalTextElement } from './types'
import { normalizeGS1 } from './utils'

const fontChars = THERMAL_FONT.chars as Record<string, readonly string[]>

const getGlyph = (char: string): readonly string[] => {
  return fontChars[char] ?? fontChars[' ']
}

const getGlyphWidth = (rows: readonly string[]): number => {
  let width = 0
  for (let i = 0; i < rows.length; i += 1) {
    width = Math.max(width, rows[i].length)
  }
  return width
}

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

export const renderThermalText = (element: ThermalTextElement, text: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = element.width
  canvas.height = element.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return canvas
  }

  ctx.fillStyle = 'black'

  const scale = element.scale || 1
  const letterSpacing = element.letterSpacing ?? 1
  const tokens = String(text).split(/(\s+)/)

  const lines: string[][] = []
  let currentLine: string[] = []
  let currentWidth = 0

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex]

    if (token === '\n') {
      lines.push(currentLine)
      currentLine = []
      currentWidth = 0
      continue
    }

    let tokenWidth = 0
    for (let i = 0; i < token.length; i += 1) {
      const glyphRows = getGlyph(token[i])
      const glyphWidth = getGlyphWidth(glyphRows)
      tokenWidth += (glyphWidth + letterSpacing) * scale
    }

    if (currentWidth + tokenWidth > element.width && currentLine.length > 0) {
      if (token.trim() !== '') {
        lines.push(currentLine)
        currentLine = [token]
        currentWidth = tokenWidth
      }
      continue
    }

    currentLine.push(token)
    currentWidth += tokenWidth
  }

  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  const lineHeight = (THERMAL_FONT.height + 1) * scale
  let currentY = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].join('').trimEnd()
    const glyphs: Array<{ rows: readonly string[]; width: number }> = []

    let lineWidth = 0
    for (let i = 0; i < line.length; i += 1) {
      const rows = getGlyph(line[i])
      const width = getGlyphWidth(rows)
      glyphs.push({ rows, width })
      lineWidth += (width + letterSpacing) * scale
    }

    if (lineWidth > 0) {
      lineWidth -= letterSpacing * scale
    }

    let currentX = 0
    if (element.align === 'center') {
      currentX = Math.max(0, Math.floor((element.width - lineWidth) / 2))
    }

    if (element.align === 'right') {
      currentX = Math.max(0, element.width - lineWidth)
    }

    for (let glyphIndex = 0; glyphIndex < glyphs.length; glyphIndex += 1) {
      const glyph = glyphs[glyphIndex]

      for (let rowIndex = 0; rowIndex < THERMAL_FONT.height; rowIndex += 1) {
        const row = glyph.rows[rowIndex] ?? ''
        for (let px = 0; px < glyph.width; px += 1) {
          if (row[px] === '#') {
            ctx.fillRect(currentX + px * scale, currentY + rowIndex * scale, scale, scale)
            if (element.bold) {
              ctx.fillRect(currentX + px * scale + 1, currentY + rowIndex * scale, scale, scale)
            }
          }
        }
      }

      currentX += (glyph.width + letterSpacing) * scale
    }

    currentY += lineHeight
  }

  return canvas
}

export const renderSystemText = (element: TextElement, text: string): HTMLCanvasElement => {
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

export const renderBarcode = (element: CodeElement, value: string): HTMLCanvasElement => {
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
  element: LineElement,
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
  ctx.lineWidth = element.thickness || 2
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
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(image, 0, 0, element.width, element.height)
        applyThreshold(canvas)
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
): Promise<HTMLCanvasElement | null> => {
  if (element.type === 'line') {
    const pad = element.thickness || 2
    const boxX = Math.min(element.x1, element.x2) - pad
    const boxY = Math.min(element.y1, element.y2) - pad
    const boxW = Math.abs(element.x2 - element.x1) + pad * 2
    const boxH = Math.abs(element.y2 - element.y1) + pad * 2
    return renderLine(element, boxW, boxH, boxX, boxY)
  }

  if (element.type === 'thermal_text') {
    return renderThermalText(element, value)
  }

  if (element.type === 'text') {
    return renderSystemText(element, value)
  }

  if (element.type === 'code') {
    return renderBarcode(element, value)
  }

  if (element.type === 'image') {
    return renderImage(element, value)
  }

  return null
}
