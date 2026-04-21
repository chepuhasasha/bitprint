export type ElementType = 'text' | 'code' | 'image' | 'line'
export type DataSource = 'static' | 'dynamic'
export type TextAlign = 'left' | 'center' | 'right'
export type BarcodeType =
  | 'gs1datamatrix'
  | 'gs1qrcode'
  | 'datamatrix'
  | 'qrcode'
  | 'ean13'
  | 'code128'

export interface BaseElement {
  id: string
  type: ElementType
  dataSource: DataSource
  csvColumn: string
}

export interface PositionedElement extends BaseElement {
  x: number
  y: number
  width: number
  height: number
}

export interface TextElement extends PositionedElement {
  type: 'text'
  staticValue: string
  fontSize: number
  align: TextAlign
  bold: boolean
}

export interface CodeElement extends PositionedElement {
  type: 'code'
  staticValue: string
  codeType: BarcodeType
  scaleMode: 'integer' | 'stretch'
}

export interface ImageElement extends PositionedElement {
  type: 'image'
  staticValue: string
}

export interface LineElement extends BaseElement {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  thickness: number
}

export type LabelElement =
  | TextElement
  | CodeElement
  | ImageElement
  | LineElement

export interface CsvState {
  fileName: string | null
  headers: string[]
  data: string[][]
}

export interface PdfLabelsState {
  fileName: string | null
  pageCount: number
  pages: string[]
  copies: number
}

export interface PrintSheetSettings {
  pageWidthMm: number
  pageHeightMm: number
  marginLeftMm: number
  marginRightMm: number
  marginTopMm: number
  marginBottomMm: number
  gapHorizontalMm: number
  gapVerticalMm: number
}

export interface EditorState {
  labelWidthMm: number
  labelHeightMm: number
  manualLabelCount: number
  printSheet: PrintSheetSettings
  elements: LabelElement[]
  selectedId: string | null
  csv: CsvState
  pdf: PdfLabelsState
}
