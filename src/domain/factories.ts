import { DEFAULT_IMAGE_DATA_URI } from './constants'
import { roundMm } from './constants'
import type { BarcodeType, DataSource, ElementType, LabelElement, LineElement } from './types'

const uid = (): string => `el_${Date.now()}_${Math.floor(Math.random() * 1000)}`

export const createDefaultElements = (): LabelElement[] => {
  return [
    {
      id: uid(),
      type: 'text',
      dataSource: 'static',
      staticValue: 'Пример текста\n123',
      csvColumn: '0',
      x: 1,
      y: 1,
      width: 13,
      height: 4,
      fontSize: 2.8,
      align: 'center',
      bold: false,
    },
    {
      id: uid(),
      type: 'code',
      dataSource: 'static',
      staticValue: '(01)04604060005904(21)J1Nq21',
      csvColumn: '0',
      x: 3.5,
      y: 6,
      width: 8,
      height: 8,
      codeType: 'gs1datamatrix',
      scaleMode: 'integer',
    },
  ]
}

export const createElementByType = (type: ElementType): LabelElement => {
  const base = {
    id: uid(),
    type,
    dataSource: 'static' as DataSource,
    csvColumn: '0',
  }

  if (type === 'text') {
    return {
      ...base,
      type,
      staticValue: 'Системный текст',
      x: 1,
      y: 1,
      width: 10,
      height: 3,
      fontSize: 2.6,
      align: 'left',
      bold: false,
    }
  }

  if (type === 'code') {
    return {
      ...base,
      type,
      staticValue: '123456789012',
      x: 1,
      y: 1,
      width: 7,
      height: 7,
      codeType: 'gs1datamatrix',
      scaleMode: 'integer',
    }
  }

  if (type === 'image') {
    return {
      ...base,
      type,
      staticValue: DEFAULT_IMAGE_DATA_URI,
      x: 1,
      y: 1,
      width: 10,
      height: 3,
    }
  }

  const line: LineElement = {
    ...base,
    type: 'line',
    x1: 1,
    y1: 1,
    x2: 10,
    y2: 1,
    thickness: 0.3,
    width: 9,
    height: 0.3,
  }

  return line
}

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? roundMm(parsed) : fallback
}

const normalizeCommon = (raw: Record<string, unknown>) => {
  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : uid(),
    dataSource: (raw.dataSource === 'dynamic' ? 'dynamic' : 'static') as DataSource,
    csvColumn: String(raw.csvColumn ?? '0'),
  }
}

const isBarcodeType = (value: unknown): value is BarcodeType => {
  return (
    value === 'gs1datamatrix' ||
    value === 'gs1qrcode' ||
    value === 'datamatrix' ||
    value === 'qrcode' ||
    value === 'ean13' ||
    value === 'code128'
  )
}

export const normalizeLoadedElement = (raw: Record<string, unknown>): LabelElement | null => {
  const type = raw.type as ElementType

  if (!['text', 'code', 'image', 'line'].includes(String(type))) {
    return null
  }

  const common = normalizeCommon(raw)

  if (type === 'line') {
    return {
      ...common,
      type,
      x1: parseNumber(raw.x1, 1),
      y1: parseNumber(raw.y1, 1),
      x2: parseNumber(raw.x2, 10),
      y2: parseNumber(raw.y2, 1),
      thickness: Math.max(0.05, parseNumber(raw.thickness, 0.3)),
      width: parseNumber(raw.width, 9),
      height: parseNumber(raw.height, 0.3),
    }
  }

  const layout = {
    x: parseNumber(raw.x, 1),
    y: parseNumber(raw.y, 1),
    width: Math.max(0.1, parseNumber(raw.width, type === 'code' ? 7 : 10)),
    height: Math.max(0.1, parseNumber(raw.height, type === 'code' ? 7 : 3)),
  }

  if (type === 'text') {
    return {
      ...common,
      ...layout,
      type,
      staticValue: String(raw.staticValue ?? 'Системный текст'),
      fontSize: Math.max(0.5, parseNumber(raw.fontSize, 2.6)),
      align: raw.align === 'center' || raw.align === 'right' ? raw.align : 'left',
      bold: Boolean(raw.bold),
    }
  }

  if (type === 'code') {
    return {
      ...common,
      ...layout,
      type,
      staticValue: String(raw.staticValue ?? '123456789012'),
      codeType: isBarcodeType(raw.codeType) ? raw.codeType : 'gs1datamatrix',
      scaleMode: raw.scaleMode === 'stretch' ? 'stretch' : 'integer',
    }
  }

  return {
    ...common,
    ...layout,
    type,
    staticValue: String(raw.staticValue ?? DEFAULT_IMAGE_DATA_URI),
  }
}

export { uid }
