import type { BarcodeType, DynamicDataSource, LabelElement, TextAlign } from './types'
import { roundMm } from './constants'

const BARCODE_TYPES: BarcodeType[] = ['gs1datamatrix', 'gs1qrcode', 'datamatrix', 'qrcode', 'ean13', 'code128']
const TEXT_ALIGNS: TextAlign[] = ['left', 'center', 'right']
const DYNAMIC_SOURCES: DynamicDataSource[] = ['static', 'dynamic']

const roundFinite = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? roundMm(parsed) : fallback
}

const toPositive = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.max(0.1, roundMm(parsed))
}

const toCsvColumn = (value: unknown, fallback: string): string => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }
  return String(parsed)
}

const toText = (value: unknown, fallback = ''): string => {
  if (value == null) {
    return fallback
  }
  return String(value)
}

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (value === true || value === 'true') {
    return true
  }
  if (value === false || value === 'false') {
    return false
  }
  return fallback
}

const toDynamicDataSource = (value: unknown, fallback: DynamicDataSource): DynamicDataSource => {
  return typeof value === 'string' && DYNAMIC_SOURCES.includes(value as DynamicDataSource)
    ? (value as DynamicDataSource)
    : fallback
}

const toTextAlign = (value: unknown, fallback: TextAlign): TextAlign => {
  return typeof value === 'string' && TEXT_ALIGNS.includes(value as TextAlign) ? (value as TextAlign) : fallback
}

const toBarcodeType = (value: unknown, fallback: BarcodeType): BarcodeType => {
  return typeof value === 'string' && BARCODE_TYPES.includes(value as BarcodeType)
    ? (value as BarcodeType)
    : fallback
}

const toCodeScaleMode = (value: unknown, fallback: 'integer' | 'stretch'): 'integer' | 'stretch' => {
  return value === 'integer' || value === 'stretch' ? value : fallback
}

const toImageScaleMode = (value: unknown, fallback: 'contain' | 'stretch'): 'contain' | 'stretch' => {
  return value === 'contain' || value === 'stretch' ? value : fallback
}

export const updateElementProperty = (element: LabelElement, key: string, value: unknown): void => {
  if (element.type === 'line') {
    switch (key) {
      case 'x1':
        element.x1 = roundFinite(value, element.x1)
        return
      case 'y1':
        element.y1 = roundFinite(value, element.y1)
        return
      case 'x2':
        element.x2 = roundFinite(value, element.x2)
        return
      case 'y2':
        element.y2 = roundFinite(value, element.y2)
        return
      case 'thickness':
        element.thickness = toPositive(value, element.thickness)
        return
      default:
        return
    }
  }

  switch (key) {
    case 'x':
      element.x = roundFinite(value, element.x)
      return
    case 'y':
      element.y = roundFinite(value, element.y)
      return
    case 'width':
      element.width = toPositive(value, element.width)
      return
    case 'height':
      element.height = toPositive(value, element.height)
      return
    case 'rotation':
      element.rotation = roundFinite(value, element.rotation)
      return
    case 'csvColumn':
      element.csvColumn = toCsvColumn(value, element.csvColumn)
      return
    case 'staticValue':
      element.staticValue = toText(value, element.staticValue)
      return
    case 'dataSource':
      if (element.type === 'image') {
        const fallback = element.dataSource === 'pdf' ? 'static' : element.dataSource
        element.dataSource = value === 'pdf' ? 'pdf' : toDynamicDataSource(value, fallback)
      } else {
        element.dataSource = toDynamicDataSource(value, element.dataSource)
      }
      return
    default:
      break
  }

  if (element.type === 'text') {
    switch (key) {
      case 'fontSize':
        element.fontSize = toPositive(value, element.fontSize)
        return
      case 'align':
        element.align = toTextAlign(value, element.align)
        return
      case 'bold':
        element.bold = toBoolean(value, element.bold)
        return
      default:
        return
    }
  }

  if (element.type === 'code') {
    switch (key) {
      case 'codeType':
        element.codeType = toBarcodeType(value, element.codeType)
        return
      case 'scaleMode':
        element.scaleMode = toCodeScaleMode(value, element.scaleMode)
        return
      default:
        return
    }
  }

  if (element.type === 'image' && key === 'scaleMode') {
    element.scaleMode = toImageScaleMode(value, element.scaleMode)
  }
}

export const applyElementPatch = (element: LabelElement, patch: Partial<LabelElement>): void => {
  for (const [key, value] of Object.entries(patch)) {
    updateElementProperty(element, key, value)
  }
}
