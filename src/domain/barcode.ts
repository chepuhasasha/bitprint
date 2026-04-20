import bwipjs from 'bwip-js'

import type { CodeElement } from './types'
import { normalizeGS1 } from './utils'

const bwipToSvg = bwipjs as unknown as {
  toSVG: (options: Record<string, unknown>) => string
}

const GS_SEPARATOR = '\x1D'
const GS_MARKERS_REGEX = /_x001D_|<GS>|\\x1d|\\x1D/g
const TWO_D_BARCODES = new Set(['gs1datamatrix', 'gs1qrcode', 'datamatrix', 'qrcode'])

const normalizeGsMarkers = (text: string): string => {
  return String(text ?? '').replace(GS_MARKERS_REGEX, GS_SEPARATOR)
}

const toFncText = (raw: string): string => {
  return `^FNC1${raw.replace(/\x1D/g, '^FNC1')}`
}

const toAiText = (raw: string): string => {
  return normalizeGS1(raw)
}

const finalizeSvgMarkup = (markup: string, scaleMode: 'integer' | 'stretch'): string => {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(markup, 'image/svg+xml')
  const svg = parsed.documentElement as unknown as SVGSVGElement

  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.setAttribute('shape-rendering', 'crispEdges')
  svg.setAttribute('preserveAspectRatio', scaleMode === 'stretch' ? 'none' : 'xMidYMid meet')

  return new XMLSerializer().serializeToString(svg)
}

const baseOptions = (codeType: string): Record<string, unknown> => {
  return {
    backgroundcolor: 'FFFFFF',
    includetext: !TWO_D_BARCODES.has(codeType),
    paddingwidth: 2,
    paddingheight: 2,
    scale: 1,
  }
}

export const buildBarcodeSvgMarkup = (element: CodeElement, value: string): string | null => {
  const raw = normalizeGsMarkers(value)

  try {
    if (element.codeType === 'gs1datamatrix') {
      const rawPayload = toFncText(raw)
      const rawMarkup = bwipToSvg.toSVG({
        ...baseOptions(element.codeType),
        bcid: 'datamatrix',
        parsefnc: true,
        text: rawPayload,
      })

      return finalizeSvgMarkup(rawMarkup, element.scaleMode)
    }

    if (element.codeType === 'gs1qrcode') {
      const rawPayload = toFncText(raw)
      const rawMarkup = bwipToSvg.toSVG({
        ...baseOptions(element.codeType),
        bcid: 'qrcode',
        parsefnc: true,
        text: rawPayload,
      })

      return finalizeSvgMarkup(rawMarkup, element.scaleMode)
    }

    const regularMarkup = bwipToSvg.toSVG({
      ...baseOptions(element.codeType),
      bcid: element.codeType,
      text: raw,
    })

    return finalizeSvgMarkup(regularMarkup, element.scaleMode)
  } catch {
    if (element.codeType !== 'gs1datamatrix' && element.codeType !== 'gs1qrcode') {
      return null
    }

    try {
      const fallbackMarkup = bwipToSvg.toSVG({
        ...baseOptions(element.codeType),
        bcid: element.codeType,
        text: toAiText(raw),
      })

      return finalizeSvgMarkup(fallbackMarkup, element.scaleMode)
    } catch {
      return null
    }
  }
}
