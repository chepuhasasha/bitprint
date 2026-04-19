import type { LabelElement } from './types'

export const parseNumber = (value: unknown, fallback = 0): number => {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

const hasStaticValue = (element: LabelElement): element is Exclude<LabelElement, { type: 'line' }> => {
  return element.type !== 'line'
}

export const getElementValue = (
  element: LabelElement,
  csvData: string[][],
  csvRow: string[] | null = null,
): string => {
  if (element.dataSource === 'static') {
    return hasStaticValue(element) ? String(element.staticValue ?? '') : ''
  }

  const row = csvRow ?? (csvData.length > 1 ? csvData[1] : null)
  if (!row) {
    return 'ДАННЫЕ'
  }

  const index = Number.parseInt(element.csvColumn, 10)
  if (!Number.isFinite(index)) {
    return ''
  }

  return row[index] ? String(row[index]).trim() : ''
}

export const normalizeGS1 = (text: string): string => {
  if (!text || !text.includes('(01)')) {
    return text
  }

  const normalized = text.replace(/_x001D_|<GS>|\\x1d|\\x1D/g, '\x1D')

  if (!/^01\d{14}21/.test(normalized)) {
    return text
  }

  let formatted = `(01)${normalized.substring(2, 16)}(21)`
  const parts = normalized.substring(18).split('\x1D')
  formatted += parts[0] ?? ''

  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i]

    if (part.startsWith('91') || part.startsWith('92') || part.startsWith('93')) {
      formatted += `(${part.substring(0, 2)})${part.substring(2)}`
      continue
    }

    if (part.startsWith('3103')) {
      formatted += `(3103)${part.substring(4)}`
      continue
    }

    if (part.length > 2) {
      formatted += `(${part.substring(0, 2)})${part.substring(2)}`
      continue
    }

    formatted += part
  }

  return formatted
}

export interface ElementBox {
  left: number
  top: number
  width: number
  height: number
}

export const getElementBox = (element: LabelElement): ElementBox => {
  if (element.type !== 'line') {
    return {
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
    }
  }

  const pad = element.thickness || 2
  return {
    left: Math.min(element.x1, element.x2) - pad,
    top: Math.min(element.y1, element.y2) - pad,
    width: Math.abs(element.x2 - element.x1) + pad * 2,
    height: Math.abs(element.y2 - element.y1) + pad * 2,
  }
}

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value))
}
