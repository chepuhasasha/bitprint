import { DEFAULT_IMAGE_DATA_URI } from './constants'
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
      x: 10,
      y: 10,
      width: 145,
      height: 40,
      fontSize: 16,
      align: 'center',
      bold: false,
    },
    {
      id: uid(),
      type: 'code',
      dataSource: 'static',
      staticValue: '(01)04604060005904(21)J1Nq21',
      csvColumn: '0',
      x: 42,
      y: 60,
      width: 80,
      height: 80,
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
      x: 10,
      y: 10,
      width: 100,
      height: 20,
      fontSize: 16,
      align: 'left',
      bold: false,
    }
  }

  if (type === 'code') {
    return {
      ...base,
      type,
      staticValue: '123456789012',
      x: 10,
      y: 10,
      width: 60,
      height: 60,
      codeType: 'gs1datamatrix',
      scaleMode: 'integer',
    }
  }

  if (type === 'image') {
    return {
      ...base,
      type,
      staticValue: DEFAULT_IMAGE_DATA_URI,
      x: 10,
      y: 10,
      width: 100,
      height: 20,
    }
  }

  const line: LineElement = {
    ...base,
    type: 'line',
    x1: 10,
    y1: 10,
    x2: 100,
    y2: 10,
    thickness: 2,
    width: 90,
    height: 2,
  }

  return line
}

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) ? parsed : fallback
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
      x1: parseNumber(raw.x1, 10),
      y1: parseNumber(raw.y1, 10),
      x2: parseNumber(raw.x2, 100),
      y2: parseNumber(raw.y2, 10),
      thickness: Math.max(1, parseNumber(raw.thickness, 2)),
      width: parseNumber(raw.width, 90),
      height: parseNumber(raw.height, 2),
    }
  }

  const layout = {
    x: parseNumber(raw.x, 10),
    y: parseNumber(raw.y, 10),
    width: Math.max(1, parseNumber(raw.width, type === 'code' ? 60 : 100)),
    height: Math.max(1, parseNumber(raw.height, type === 'code' ? 60 : 20)),
  }

  if (type === 'text') {
    return {
      ...common,
      ...layout,
      type,
      staticValue: String(raw.staticValue ?? 'Системный текст'),
      fontSize: Math.max(1, parseNumber(raw.fontSize, 16)),
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
