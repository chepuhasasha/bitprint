import type { PrintSheetSettings } from './types'

export interface PrintGrid {
  columns: number
  rows: number
  labelsPerPage: number
}

interface LabelGridPosition {
  leftMm: number
  topMm: number
}

const FLOAT_EPSILON = 1e-9

const asPositive = (value: number, fallback: number): number => {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const asNonNegative = (value: number): number => {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export const normalizePrintSheet = (settings: PrintSheetSettings): PrintSheetSettings => {
  return {
    pageWidthMm: asPositive(settings.pageWidthMm, 210),
    pageHeightMm: asPositive(settings.pageHeightMm, 297),
    marginLeftMm: asNonNegative(settings.marginLeftMm),
    marginRightMm: asNonNegative(settings.marginRightMm),
    marginTopMm: asNonNegative(settings.marginTopMm),
    marginBottomMm: asNonNegative(settings.marginBottomMm),
    gapHorizontalMm: asNonNegative(settings.gapHorizontalMm),
    gapVerticalMm: asNonNegative(settings.gapVerticalMm),
  }
}

export const calculatePrintGrid = (
  labelWidthMm: number,
  labelHeightMm: number,
  settings: PrintSheetSettings,
): PrintGrid => {
  const safeLabelWidth = asPositive(labelWidthMm, 1)
  const safeLabelHeight = asPositive(labelHeightMm, 1)
  const safe = normalizePrintSheet(settings)

  const usableWidth = safe.pageWidthMm - safe.marginLeftMm - safe.marginRightMm
  const usableHeight = safe.pageHeightMm - safe.marginTopMm - safe.marginBottomMm

  if (usableWidth < safeLabelWidth || usableHeight < safeLabelHeight) {
    return {
      columns: 0,
      rows: 0,
      labelsPerPage: 0,
    }
  }

  const columns = Math.max(
    0,
    Math.floor((usableWidth + safe.gapHorizontalMm + FLOAT_EPSILON) / (safeLabelWidth + safe.gapHorizontalMm)),
  )
  const rows = Math.max(
    0,
    Math.floor((usableHeight + safe.gapVerticalMm + FLOAT_EPSILON) / (safeLabelHeight + safe.gapVerticalMm)),
  )

  return {
    columns,
    rows,
    labelsPerPage: columns * rows,
  }
}

export const getGridLabelPosition = (
  gridIndex: number,
  columns: number,
  labelWidthMm: number,
  labelHeightMm: number,
  settings: PrintSheetSettings,
): LabelGridPosition => {
  const safe = normalizePrintSheet(settings)
  const columnIndex = columns > 0 ? gridIndex % columns : 0
  const rowIndex = columns > 0 ? Math.floor(gridIndex / columns) : 0

  return {
    leftMm: safe.marginLeftMm + columnIndex * (labelWidthMm + safe.gapHorizontalMm),
    topMm: safe.marginTopMm + rowIndex * (labelHeightMm + safe.gapVerticalMm),
  }
}
