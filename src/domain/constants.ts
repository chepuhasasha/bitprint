import type { PrintSheetSettings } from './types'

export const PREVIEW_PX_PER_MM = 14
export const PRINT_RASTER_PX_PER_MM = 16

export const mmToPx = (mm: number, pxPerMm: number): number => {
  const safeMm = Number.isFinite(mm) ? mm : 0
  const safePxPerMm = Number.isFinite(pxPerMm) && pxPerMm > 0 ? pxPerMm : PREVIEW_PX_PER_MM
  return Math.max(1, Math.round(safeMm * safePxPerMm))
}

export const roundMm = (value: number, precision = 100): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * precision) / precision
}

export const DEFAULT_LABEL_MM = {
  width: 15,
  height: 15,
} as const

export const A4_PAGE_SIZE_MM = {
  width: 210,
  height: 297,
} as const

export const DEFAULT_PRINT_SHEET_SETTINGS: PrintSheetSettings = {
  pageWidthMm: A4_PAGE_SIZE_MM.width,
  pageHeightMm: A4_PAGE_SIZE_MM.height,
  marginLeftMm: 10,
  marginRightMm: 10,
  marginTopMm: 9,
  marginBottomMm: 10.05,
  gapHorizontalMm: 2.5,
  gapVerticalMm: 2.53,
}

export const DEFAULT_IMAGE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E"

export const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Влево' },
  { value: 'center', label: 'Центр' },
  { value: 'right', label: 'Вправо' },
] as const

export const CODE_TYPE_OPTIONS = [
  { value: 'gs1datamatrix', label: 'GS1 DataMatrix (ЧЗ)' },
  { value: 'gs1qrcode', label: 'GS1 QR' },
  { value: 'datamatrix', label: 'Data Matrix' },
  { value: 'qrcode', label: 'QR-код' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'code128', label: 'Code 128' },
] as const
