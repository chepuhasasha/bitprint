import { buildBarcodeSvgMarkup } from './barcode'
import { roundMm } from './constants'
import type { LabelElement } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'

interface LabelDomOptions {
  labelWidthMm?: number
  labelHeightMm?: number
}

const setAbsoluteMmBox = (
  element: HTMLElement,
  leftMm: number,
  topMm: number,
  widthMm: number,
  heightMm: number,
): void => {
  element.style.position = 'absolute'
  element.style.left = `${leftMm}mm`
  element.style.top = `${topMm}mm`
  element.style.width = `${widthMm}mm`
  element.style.height = `${heightMm}mm`
  element.style.boxSizing = 'border-box'
}

const getRotation = (value: unknown): number => {
  const rotation = Number(value)
  return Number.isFinite(rotation) ? roundMm(rotation) : 0
}

const applyRotationStyle = (node: HTMLElement, rotation: unknown): void => {
  const angle = getRotation(rotation)
  if (angle === 0) {
    return
  }

  node.style.transformOrigin = '50% 50%'
  node.style.transform = `rotate(${angle}deg)`
}

const createTextNode = (element: Extract<LabelElement, { type: 'text' }>, value: string): HTMLElement => {
  const node = document.createElement('div')
  setAbsoluteMmBox(node, element.x, element.y, element.width, element.height)
  applyRotationStyle(node, element.rotation)
  node.style.whiteSpace = 'pre-wrap'
  node.style.wordBreak = 'break-word'
  node.style.overflow = 'hidden'
  node.style.fontFamily = 'Arial, sans-serif'
  node.style.fontSize = `${Math.max(0.1, element.fontSize)}mm`
  node.style.fontWeight = element.bold ? '700' : '400'
  node.style.lineHeight = '1.15'
  node.style.color = '#000'
  node.style.textAlign = element.align
  node.textContent = value
  return node
}

const createImageNode = (element: Extract<LabelElement, { type: 'image' }>, value: string): HTMLElement => {
  const node = document.createElement('img')
  setAbsoluteMmBox(node, element.x, element.y, element.width, element.height)
  applyRotationStyle(node, element.rotation)
  node.style.objectFit = element.scaleMode === 'stretch' ? 'fill' : 'contain'
  node.style.objectPosition = 'center'
  node.style.display = 'block'
  node.draggable = false
  node.src = value
  return node
}

const createLineNode = (
  element: Extract<LabelElement, { type: 'line' }>,
  options: LabelDomOptions,
): HTMLElement => {
  const labelWidthMm = Number(options.labelWidthMm)
  const labelHeightMm = Number(options.labelHeightMm)
  if (Number.isFinite(labelWidthMm) && labelWidthMm > 0 && Number.isFinite(labelHeightMm) && labelHeightMm > 0) {
    const wrapper = document.createElement('div')
    wrapper.style.position = 'absolute'
    wrapper.style.left = '0'
    wrapper.style.top = '0'
    wrapper.style.width = '100%'
    wrapper.style.height = '100%'
    wrapper.style.pointerEvents = 'none'

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.setAttribute('viewBox', `0 0 ${labelWidthMm} ${labelHeightMm}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.style.display = 'block'
    svg.style.overflow = 'visible'

    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(element.x1))
    line.setAttribute('y1', String(element.y1))
    line.setAttribute('x2', String(element.x2))
    line.setAttribute('y2', String(element.y2))
    line.setAttribute('stroke', '#000')
    line.setAttribute('stroke-width', String(Math.max(0.01, element.thickness)))
    line.setAttribute('stroke-linecap', 'square')
    svg.appendChild(line)
    wrapper.appendChild(svg)

    return wrapper
  }

  const node = document.createElement('div')
  const dx = element.x2 - element.x1
  const dy = element.y2 - element.y1
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  node.style.position = 'absolute'
  node.style.left = `${element.x1}mm`
  node.style.top = `${element.y1 - element.thickness / 2}mm`
  node.style.width = `${Math.max(0.01, length)}mm`
  node.style.height = `${Math.max(0.01, element.thickness)}mm`
  node.style.background = '#000'
  node.style.transformOrigin = '0 50%'
  node.style.transform = `rotate(${angle}deg)`

  return node
}

const createBarcodeNode = (element: Extract<LabelElement, { type: 'code' }>, value: string): HTMLElement => {
  const wrapper = document.createElement('div')
  setAbsoluteMmBox(wrapper, element.x, element.y, element.width, element.height)
  applyRotationStyle(wrapper, element.rotation)
  wrapper.style.display = 'flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.justifyContent = 'center'
  wrapper.style.overflow = 'hidden'

  const svgMarkup = buildBarcodeSvgMarkup(element, value)
  if (svgMarkup) {
    const parser = new DOMParser()
    const parsed = parser.parseFromString(svgMarkup, 'image/svg+xml')
    const svg = parsed.documentElement as unknown as SVGSVGElement

    svg.style.display = 'block'

    wrapper.appendChild(svg)
  }

  return wrapper
}

export const createLabelDom = (
  elements: LabelElement[],
  getValue: (element: LabelElement) => string,
  options: LabelDomOptions = {},
): HTMLElement => {
  const root = document.createElement('div')
  root.className = 'print-label-root'
  root.style.position = 'relative'
  root.style.width = '100%'
  root.style.height = '100%'
  root.style.overflow = 'hidden'
  root.style.background = '#fff'

  for (let i = 0; i < elements.length; i += 1) {
    const element = elements[i]
    const value = getValue(element)

    if (element.type === 'text') {
      root.appendChild(createTextNode(element, value))
      continue
    }

    if (element.type === 'image') {
      root.appendChild(createImageNode(element, value))
      continue
    }

    if (element.type === 'line') {
      root.appendChild(createLineNode(element, options))
      continue
    }

    root.appendChild(createBarcodeNode(element, value))
  }

  return root
}
