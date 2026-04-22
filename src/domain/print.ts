import type { PrintCalibrationSettings, PrintSheetSettings } from './types'

export interface PrintGrid {
  columns: number
  rows: number
  labelsPerPage: number
  gapHorizontalMm: number
  gapVerticalMm: number
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

const asFinite = (value: number): number => {
  return Number.isFinite(value) ? value : 0
}

const calculateExpandedGap = (usableSize: number, itemSize: number, itemCount: number, minGap: number): number => {
  if (itemCount <= 1) {
    return minGap
  }

  const availableGapSpace = usableSize - itemSize * itemCount
  if (availableGapSpace <= FLOAT_EPSILON) {
    return minGap
  }

  return Math.max(minGap, availableGapSpace / (itemCount - 1))
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

export const normalizePrintCalibration = (settings: PrintCalibrationSettings): PrintCalibrationSettings => {
  return {
    topLeft: {
      xMm: asFinite(settings.topLeft.xMm),
      yMm: asFinite(settings.topLeft.yMm),
    },
    topRight: {
      xMm: asFinite(settings.topRight.xMm),
      yMm: asFinite(settings.topRight.yMm),
    },
    bottomLeft: {
      xMm: asFinite(settings.bottomLeft.xMm),
      yMm: asFinite(settings.bottomLeft.yMm),
    },
    bottomRight: {
      xMm: asFinite(settings.bottomRight.xMm),
      yMm: asFinite(settings.bottomRight.yMm),
    },
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
      gapHorizontalMm: safe.gapHorizontalMm,
      gapVerticalMm: safe.gapVerticalMm,
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
  const gapHorizontalMm = calculateExpandedGap(usableWidth, safeLabelWidth, columns, safe.gapHorizontalMm)
  const gapVerticalMm = calculateExpandedGap(usableHeight, safeLabelHeight, rows, safe.gapVerticalMm)

  return {
    columns,
    rows,
    labelsPerPage: columns * rows,
    gapHorizontalMm,
    gapVerticalMm,
  }
}

export const getGridLabelPosition = (
  gridIndex: number,
  grid: PrintGrid,
  labelWidthMm: number,
  labelHeightMm: number,
  settings: PrintSheetSettings,
): LabelGridPosition => {
  const safe = normalizePrintSheet(settings)
  const safeLabelWidth = asPositive(labelWidthMm, 1)
  const safeLabelHeight = asPositive(labelHeightMm, 1)
  const columnIndex = grid.columns > 0 ? gridIndex % grid.columns : 0
  const rowIndex = grid.columns > 0 ? Math.floor(gridIndex / grid.columns) : 0

  return {
    leftMm: safe.marginLeftMm + columnIndex * (safeLabelWidth + grid.gapHorizontalMm),
    topMm: safe.marginTopMm + rowIndex * (safeLabelHeight + grid.gapVerticalMm),
  }
}

const lerp = (start: number, end: number, factor: number): number => {
  return start + (end - start) * factor
}

export const getCalibratedGridLabelPosition = (
  gridIndex: number,
  grid: PrintGrid,
  labelWidthMm: number,
  labelHeightMm: number,
  sheetSettings: PrintSheetSettings,
  calibrationSettings: PrintCalibrationSettings,
): LabelGridPosition => {
  const base = getGridLabelPosition(gridIndex, grid, labelWidthMm, labelHeightMm, sheetSettings)
  const calibration = normalizePrintCalibration(calibrationSettings)

  const columnIndex = grid.columns > 0 ? gridIndex % grid.columns : 0
  const rowIndex = grid.columns > 0 ? Math.floor(gridIndex / grid.columns) : 0
  const u = grid.columns > 1 ? columnIndex / (grid.columns - 1) : 0
  const v = grid.rows > 1 ? rowIndex / (grid.rows - 1) : 0

  const measuredXOnTop = lerp(calibration.topLeft.xMm, calibration.topRight.xMm, u)
  const measuredXOnBottom = lerp(calibration.bottomLeft.xMm, calibration.bottomRight.xMm, u)
  const measuredYOnLeft = lerp(calibration.topLeft.yMm, calibration.bottomLeft.yMm, v)
  const measuredYOnRight = lerp(calibration.topRight.yMm, calibration.bottomRight.yMm, v)

  const measuredX = lerp(measuredXOnTop, measuredXOnBottom, v)
  const measuredY = lerp(measuredYOnLeft, measuredYOnRight, u)

  return {
    leftMm: base.leftMm - measuredX,
    topMm: base.topMm - measuredY,
  }
}
