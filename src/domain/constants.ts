export const CANVAS_SCALE = 3
export const DEFAULT_DPI = 203
export const MM_PER_INCH = 25.4

export const getDotsPerMm = (dpi: number): number => {
  const normalizedDpi = Number.isFinite(dpi) && dpi > 0 ? dpi : DEFAULT_DPI
  return normalizedDpi / MM_PER_INCH
}

export const dotsToMm = (dots: number, dpi: number): number => {
  return dots / getDotsPerMm(dpi)
}

export const mmToDots = (mm: number, dpi: number): number => {
  return Math.round(mm * getDotsPerMm(dpi))
}

export const DEFAULT_LABEL_SIZE = {
  width: 165,
  height: 165,
} as const

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
