import { DEFAULT_IMAGE_DATA_URI } from './constants'
import type { DataSource, ElementType, LabelElement, LineElement } from './types'

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
  }

  return line
}

export { uid }
