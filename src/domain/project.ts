import type { LabelElement, PrintSheetSettings } from './types'

const PROJECT_PAYLOAD_KEYS = [
  'labelWidthMm',
  'labelHeightMm',
  'manualLabelCount',
  'pdfCopies',
  'printSheet',
  'elements',
] as const

const PRINT_SHEET_KEYS = [
  'pageWidthMm',
  'pageHeightMm',
  'marginLeftMm',
  'marginRightMm',
  'marginTopMm',
  'marginBottomMm',
  'gapHorizontalMm',
  'gapVerticalMm',
] as const

const TEXT_ELEMENT_KEYS = [
  'id',
  'type',
  'dataSource',
  'csvColumn',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'staticValue',
  'fontSize',
  'align',
  'bold',
] as const

const CODE_ELEMENT_KEYS = [
  'id',
  'type',
  'dataSource',
  'csvColumn',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'staticValue',
  'codeType',
  'scaleMode',
] as const

const IMAGE_ELEMENT_KEYS = [
  'id',
  'type',
  'dataSource',
  'csvColumn',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'staticValue',
  'scaleMode',
] as const

const LINE_ELEMENT_KEYS = [
  'id',
  'type',
  'dataSource',
  'csvColumn',
  'x1',
  'y1',
  'x2',
  'y2',
  'thickness',
] as const

const CODE_TYPES = new Set(['gs1datamatrix', 'gs1qrcode', 'datamatrix', 'qrcode', 'ean13', 'code128'])

export interface SavedProjectPayload {
  labelWidthMm: number
  labelHeightMm: number
  manualLabelCount: number
  pdfCopies: number
  printSheet: PrintSheetSettings
  elements: LabelElement[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const objectKeys = Object.keys(value)
  return objectKeys.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value)
}

const isString = (value: unknown): value is string => {
  return typeof value === 'string'
}

const isNonEmptyString = (value: unknown): value is string => {
  return isString(value) && value.length > 0
}

const isDataSource = (value: unknown): value is 'static' | 'dynamic' | 'pdf' => {
  return value === 'static' || value === 'dynamic' || value === 'pdf'
}

const isTextAlign = (value: unknown): value is 'left' | 'center' | 'right' => {
  return value === 'left' || value === 'center' || value === 'right'
}

const isImageScaleMode = (value: unknown): value is 'contain' | 'stretch' => {
  return value === 'contain' || value === 'stretch'
}

const isCommonElementPropsValid = (value: Record<string, unknown>): boolean => {
  return isNonEmptyString(value.id) && isDataSource(value.dataSource) && isString(value.csvColumn)
}

const isPositionedElementPropsValid = (value: Record<string, unknown>): boolean => {
  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    value.width > 0 &&
    isFiniteNumber(value.height) &&
    value.height > 0 &&
    isFiniteNumber(value.rotation)
  )
}

const isValidElement = (value: unknown): value is LabelElement => {
  if (!isRecord(value) || !isString(value.type)) {
    return false
  }

  if (value.type === 'text') {
    return (
      hasExactKeys(value, TEXT_ELEMENT_KEYS) &&
      isCommonElementPropsValid(value) &&
      isPositionedElementPropsValid(value) &&
      isString(value.staticValue) &&
      isFiniteNumber(value.fontSize) &&
      value.fontSize > 0 &&
      isTextAlign(value.align) &&
      typeof value.bold === 'boolean'
    )
  }

  if (value.type === 'code') {
    return (
      hasExactKeys(value, CODE_ELEMENT_KEYS) &&
      isCommonElementPropsValid(value) &&
      isPositionedElementPropsValid(value) &&
      isString(value.staticValue) &&
      isString(value.codeType) &&
      CODE_TYPES.has(value.codeType) &&
      (value.scaleMode === 'integer' || value.scaleMode === 'stretch')
    )
  }

  if (value.type === 'image') {
    return (
      hasExactKeys(value, IMAGE_ELEMENT_KEYS) &&
      isCommonElementPropsValid(value) &&
      isPositionedElementPropsValid(value) &&
      isString(value.staticValue) &&
      isImageScaleMode(value.scaleMode)
    )
  }

  if (value.type === 'line') {
    return (
      hasExactKeys(value, LINE_ELEMENT_KEYS) &&
      isCommonElementPropsValid(value) &&
      isFiniteNumber(value.x1) &&
      isFiniteNumber(value.y1) &&
      isFiniteNumber(value.x2) &&
      isFiniteNumber(value.y2) &&
      isFiniteNumber(value.thickness) &&
      value.thickness > 0
    )
  }

  return false
}

const isValidPrintSheet = (value: unknown): value is PrintSheetSettings => {
  if (!isRecord(value) || !hasExactKeys(value, PRINT_SHEET_KEYS)) {
    return false
  }

  return (
    isFiniteNumber(value.pageWidthMm) &&
    value.pageWidthMm > 0 &&
    isFiniteNumber(value.pageHeightMm) &&
    value.pageHeightMm > 0 &&
    isFiniteNumber(value.marginLeftMm) &&
    value.marginLeftMm >= 0 &&
    isFiniteNumber(value.marginRightMm) &&
    value.marginRightMm >= 0 &&
    isFiniteNumber(value.marginTopMm) &&
    value.marginTopMm >= 0 &&
    isFiniteNumber(value.marginBottomMm) &&
    value.marginBottomMm >= 0 &&
    isFiniteNumber(value.gapHorizontalMm) &&
    value.gapHorizontalMm >= 0 &&
    isFiniteNumber(value.gapVerticalMm) &&
    value.gapVerticalMm >= 0
  )
}

export const isValidProjectPayload = (value: unknown): value is SavedProjectPayload => {
  if (!isRecord(value) || !hasExactKeys(value, PROJECT_PAYLOAD_KEYS)) {
    return false
  }

  const manualLabelCount = value.manualLabelCount
  const pdfCopies = value.pdfCopies

  return (
    isFiniteNumber(value.labelWidthMm) &&
    value.labelWidthMm > 0 &&
    isFiniteNumber(value.labelHeightMm) &&
    value.labelHeightMm > 0 &&
    isFiniteNumber(manualLabelCount) &&
    Number.isInteger(manualLabelCount) &&
    manualLabelCount > 0 &&
    isFiniteNumber(pdfCopies) &&
    Number.isInteger(pdfCopies) &&
    pdfCopies > 0 &&
    isValidPrintSheet(value.printSheet) &&
    Array.isArray(value.elements) &&
    value.elements.every((item) => isValidElement(item))
  )
}
