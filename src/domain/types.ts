export type ElementType = 'text' | 'code' | 'image' | 'line'
export type DataSource = 'static' | 'dynamic' | 'pdf'
export type DynamicDataSource = Exclude<DataSource, 'pdf'>
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
}

export interface DataBoundElement<TSource extends DataSource = DataSource> extends BaseElement {
  dataSource: TSource
  csvColumn: string
}

export interface PositionedElement<TSource extends DataSource = DataSource> extends DataBoundElement<TSource> {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface TextElement extends PositionedElement<DynamicDataSource> {
  type: 'text'
  staticValue: string
  fontSize: number
  align: TextAlign
  bold: boolean
}

export interface CodeElement extends PositionedElement<DynamicDataSource> {
  type: 'code'
  staticValue: string
  codeType: BarcodeType
  scaleMode: 'integer' | 'stretch'
}

export interface ImageElement extends PositionedElement {
  type: 'image'
  staticValue: string
  scaleMode: 'contain' | 'stretch'
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
  pageWidthMm: number
  pageHeightMm: number
  pages: string[]
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

export interface CalibrationPointShift {
  xMm: number
  yMm: number
}

export interface PrintCalibrationSettings {
  topLeft: CalibrationPointShift
  topRight: CalibrationPointShift
  bottomLeft: CalibrationPointShift
  bottomRight: CalibrationPointShift
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
