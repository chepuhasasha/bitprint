import Papa from 'papaparse'
import { computed, reactive, ref } from 'vue'

import {
  DEFAULT_PRINT_CALIBRATION_SETTINGS,
  DEFAULT_LABEL_MM,
  DEFAULT_PRINT_SHEET_SETTINGS,
  roundMm,
} from '../domain/constants'
import { applyElementPatch, updateElementProperty } from '../domain/elementMutations'
import { createDefaultElements, createElementByType } from '../domain/factories'
import { createLabelDom } from '../domain/labelDom'
import { loadPdfLabels as loadPdfPages } from '../domain/pdf'
import {
  calculatePrintGrid,
  getCalibratedGridLabelPosition,
  getGridLabelPosition,
  normalizePrintCalibration,
  normalizePrintSheet,
} from '../domain/print'
import { isValidProjectPayload } from '../domain/project'
import type { SavedProjectPayload } from '../domain/project'
import type {
  CalibrationPointShift,
  EditorState,
  ElementType,
  LabelElement,
  PrintCalibrationSettings,
  PrintSheetSettings,
} from '../domain/types'
import { getElementValue } from '../domain/utils'

const PRINT_CALIBRATION_STORAGE_KEY = 'bitprint.print-calibration.v1'

type PrintCalibrationPatch = {
  topLeft?: Partial<CalibrationPointShift>
  topRight?: Partial<CalibrationPointShift>
  bottomLeft?: Partial<CalibrationPointShift>
  bottomRight?: Partial<CalibrationPointShift>
}

const parsePositiveFloat = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseNonNegativeFloat = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const parseFiniteFloat = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const toCalibrationPointPatch = (value: unknown): Partial<CalibrationPointShift> => {
  if (!isRecord(value)) {
    return {}
  }

  const patch: Partial<CalibrationPointShift> = {}

  if ('xMm' in value) {
    patch.xMm = parseFiniteFloat(value.xMm, 0)
  }

  if ('yMm' in value) {
    patch.yMm = parseFiniteFloat(value.yMm, 0)
  }

  return patch
}

const toCalibrationPatch = (value: unknown): PrintCalibrationPatch => {
  if (!isRecord(value)) {
    return {}
  }

  return {
    topLeft: toCalibrationPointPatch(value.topLeft),
    topRight: toCalibrationPointPatch(value.topRight),
    bottomLeft: toCalibrationPointPatch(value.bottomLeft),
    bottomRight: toCalibrationPointPatch(value.bottomRight),
  }
}

const mergePrintSheet = (
  current: PrintSheetSettings,
  patch: Partial<PrintSheetSettings>,
): PrintSheetSettings => {
  return normalizePrintSheet({
    pageWidthMm: parsePositiveFloat(patch.pageWidthMm, current.pageWidthMm),
    pageHeightMm: parsePositiveFloat(patch.pageHeightMm, current.pageHeightMm),
    marginLeftMm: parseNonNegativeFloat(patch.marginLeftMm, current.marginLeftMm),
    marginRightMm: parseNonNegativeFloat(patch.marginRightMm, current.marginRightMm),
    marginTopMm: parseNonNegativeFloat(patch.marginTopMm, current.marginTopMm),
    marginBottomMm: parseNonNegativeFloat(patch.marginBottomMm, current.marginBottomMm),
    gapHorizontalMm: parseNonNegativeFloat(patch.gapHorizontalMm, current.gapHorizontalMm),
    gapVerticalMm: parseNonNegativeFloat(patch.gapVerticalMm, current.gapVerticalMm),
  })
}

const mergePrintCalibration = (
  current: PrintCalibrationSettings,
  patch: PrintCalibrationPatch,
): PrintCalibrationSettings => {
  const topLeft: Partial<CalibrationPointShift> = patch.topLeft ?? {}
  const topRight: Partial<CalibrationPointShift> = patch.topRight ?? {}
  const bottomLeft: Partial<CalibrationPointShift> = patch.bottomLeft ?? {}
  const bottomRight: Partial<CalibrationPointShift> = patch.bottomRight ?? {}

  return normalizePrintCalibration({
    topLeft: {
      xMm: parseFiniteFloat(topLeft.xMm, current.topLeft.xMm),
      yMm: parseFiniteFloat(topLeft.yMm, current.topLeft.yMm),
    },
    topRight: {
      xMm: parseFiniteFloat(topRight.xMm, current.topRight.xMm),
      yMm: parseFiniteFloat(topRight.yMm, current.topRight.yMm),
    },
    bottomLeft: {
      xMm: parseFiniteFloat(bottomLeft.xMm, current.bottomLeft.xMm),
      yMm: parseFiniteFloat(bottomLeft.yMm, current.bottomLeft.yMm),
    },
    bottomRight: {
      xMm: parseFiniteFloat(bottomRight.xMm, current.bottomRight.xMm),
      yMm: parseFiniteFloat(bottomRight.yMm, current.bottomRight.yMm),
    },
  })
}

export const useLabelEditor = () => {
  const state = reactive<EditorState>({
    labelWidthMm: DEFAULT_LABEL_MM.width,
    labelHeightMm: DEFAULT_LABEL_MM.height,
    manualLabelCount: 1,
    printSheet: { ...DEFAULT_PRINT_SHEET_SETTINGS },
    elements: [],
    selectedId: null,
    csv: {
      fileName: null,
      headers: [],
      data: [],
    },
    pdf: {
      fileName: null,
      pageCount: 0,
      pageWidthMm: 0,
      pageHeightMm: 0,
      pages: [],
    },
  })

  const printInProgress = ref(false)
  const printProgressText = ref('Печать A4')
  const pdfLoading = ref(false)
  const pdfLoadingText = ref('')
  const debugPrintGridEnabled = ref(true)
  const printCalibrationEnabled = ref(true)
  const printCalibration = ref<PrintCalibrationSettings>({
    ...DEFAULT_PRINT_CALIBRATION_SETTINGS,
  })

  const persistPrintCalibrationState = (): void => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(
        PRINT_CALIBRATION_STORAGE_KEY,
        JSON.stringify({
          enabled: printCalibrationEnabled.value,
          calibration: printCalibration.value,
        }),
      )
    } catch {
      // Ignore storage errors (private mode/quota).
    }
  }

  const loadPrintCalibrationState = (): void => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const raw = window.localStorage.getItem(PRINT_CALIBRATION_STORAGE_KEY)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as unknown
      if (!isRecord(parsed)) {
        return
      }

      if (typeof parsed.enabled === 'boolean') {
        printCalibrationEnabled.value = parsed.enabled
      }

      const calibrationSource = 'calibration' in parsed ? parsed.calibration : parsed
      printCalibration.value = mergePrintCalibration(printCalibration.value, toCalibrationPatch(calibrationSource))
    } catch {
      // Ignore invalid/missing local state.
    }
  }

  loadPrintCalibrationState()

  const selectedElement = computed<LabelElement | null>(() => {
    return state.elements.find((element) => element.id === state.selectedId) ?? null
  })

  const printGrid = computed(() => {
    return calculatePrintGrid(state.labelWidthMm, state.labelHeightMm, state.printSheet)
  })

  const initDefaults = (): void => {
    state.elements = createDefaultElements()
    state.selectedId = state.elements[0]?.id ?? null
  }

  const setLabelSizeMm = (widthMm: unknown, heightMm: unknown): void => {
    state.labelWidthMm = roundMm(parsePositiveFloat(widthMm, state.labelWidthMm))
    state.labelHeightMm = roundMm(parsePositiveFloat(heightMm, state.labelHeightMm))
  }

  const updatePrintSheet = (patch: Partial<PrintSheetSettings>): void => {
    state.printSheet = mergePrintSheet(state.printSheet, patch)
  }

  const setDebugPrintGridEnabled = (value: unknown): void => {
    debugPrintGridEnabled.value = Boolean(value)
  }

  const setPrintCalibrationEnabled = (value: unknown): void => {
    printCalibrationEnabled.value = Boolean(value)
    persistPrintCalibrationState()
  }

  const updatePrintCalibration = (patch: PrintCalibrationPatch): void => {
    printCalibration.value = mergePrintCalibration(printCalibration.value, patch)
    persistPrintCalibrationState()
  }

  const setManualLabelCount = (count: unknown): void => {
    const normalized = Math.floor(parsePositiveFloat(count, state.manualLabelCount))
    state.manualLabelCount = Math.max(1, normalized)
  }

  const addElement = (type: ElementType): void => {
    const element = createElementByType(type)
    state.elements.push(element)
    state.selectedId = element.id
  }

  const deleteElement = (id: string): void => {
    state.elements = state.elements.filter((item) => item.id !== id)
    if (state.selectedId === id) {
      state.selectedId = state.elements[0]?.id ?? null
    }
  }

  const selectElement = (id: string | null): void => {
    state.selectedId = id
  }

  const moveElement = (id: string, direction: 'forward' | 'backward'): void => {
    const fromIndex = state.elements.findIndex((item) => item.id === id)
    if (fromIndex < 0) {
      return
    }

    const toIndex = direction === 'forward' ? fromIndex + 1 : fromIndex - 1
    if (toIndex < 0 || toIndex >= state.elements.length) {
      return
    }

    const [moved] = state.elements.splice(fromIndex, 1)
    if (!moved) {
      return
    }
    state.elements.splice(toIndex, 0, moved)
  }

  const updateSelectedProp = (key: string, value: unknown): void => {
    const element = selectedElement.value
    if (!element) {
      return
    }

    updateElementProperty(element, key, value)

    if (key === 'dataSource' && element.type === 'image' && element.dataSource === 'pdf') {
      element.scaleMode = 'contain'
      applyPdfSizeToImageElement(element)
    }
  }

  const updateElement = (id: string, patch: Partial<LabelElement>): void => {
    const element = state.elements.find((item) => item.id === id)
    if (!element) {
      return
    }

    applyElementPatch(element, patch)

    if (element.type === 'image' && element.dataSource === 'pdf') {
      element.scaleMode = 'contain'
      applyPdfSizeToImageElement(element)
    }
  }

  const getPdfPageSizeMm = (): { widthMm: number; heightMm: number } | null => {
    if (state.pdf.pageWidthMm <= 0 || state.pdf.pageHeightMm <= 0) {
      return null
    }

    return {
      widthMm: Math.max(0.1, roundMm(state.pdf.pageWidthMm)),
      heightMm: Math.max(0.1, roundMm(state.pdf.pageHeightMm)),
    }
  }

  const applyPdfSizeToImageElement = (element: LabelElement): void => {
    if (element.type !== 'image' || element.dataSource !== 'pdf') {
      return
    }

    const pdfSize = getPdfPageSizeMm()
    if (!pdfSize) {
      return
    }

    element.width = pdfSize.widthMm
    element.height = pdfSize.heightMm
  }

  const getCsvRows = (): string[][] => {
    return state.csv.data.length > 1 ? state.csv.data.slice(1) : []
  }

  const getBaseLabelCount = (hasCsvFile: boolean, csvRowsCount: number, pdfPagesCount: number): number => {
    if (hasCsvFile && pdfPagesCount > 0) {
      return Math.max(csvRowsCount, pdfPagesCount)
    }

    if (hasCsvFile) {
      return csvRowsCount
    }

    if (pdfPagesCount > 0) {
      return pdfPagesCount
    }

    return Math.max(1, Math.floor(state.manualLabelCount))
  }

  const getCsvPdfMismatchWarning = (csvRowsCount: number, pdfPagesCount: number): string | null => {
    if (csvRowsCount === pdfPagesCount) {
      return null
    }

    if (csvRowsCount > pdfPagesCount) {
      return `В CSV ${csvRowsCount} строк, а в PDF ${pdfPagesCount} стр.\nСтраницы PDF будут повторяться по кругу.\nПродолжить печать?`
    }

    return `В CSV ${csvRowsCount} строк, а в PDF ${pdfPagesCount} стр.\nСтроки CSV будут повторяться по кругу.\nПродолжить печать?`
  }

  const getCycledIndex = (index: number, size: number): number => {
    if (size <= 0) {
      return 0
    }

    return index % size
  }

  const getCsvRowByRenderIndex = (renderIndex: number, rows: string[][]): string[] | null => {
    if (rows.length <= 0) {
      return null
    }

    return rows[getCycledIndex(renderIndex, rows.length)] ?? null
  }

  const getPdfPageByRenderIndex = (renderIndex: number): string => {
    const pages = state.pdf.pages
    if (pages.length <= 0) {
      return ''
    }

    return pages[getCycledIndex(renderIndex, pages.length)] ?? ''
  }

  const getValue = (element: LabelElement, csvRow: string[] | null = null, pdfPageIndex = 0): string => {
    if (element.type === 'image' && element.dataSource === 'pdf') {
      return getPdfPageByRenderIndex(pdfPageIndex)
    }

    return getElementValue(element, state.csv.data, csvRow)
  }

  const clearCsv = (): void => {
    state.csv.fileName = null
    state.csv.data = []
    state.csv.headers = []
  }

  const loadCsv = async (file: File): Promise<void> => {
    state.csv.fileName = file.name

    await new Promise<void>((resolve) => {
      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: true,
        complete: (result) => {
          if (result.data.length > 0) {
            state.csv.data = result.data
            state.csv.headers = result.data[0].map((item) => String(item ?? ''))
          } else {
            state.csv.data = []
            state.csv.headers = []
          }
          resolve()
        },
        error: () => {
          clearCsv()
          resolve()
        },
      })
    })
  }

  const loadImageForSelected = async (file: File): Promise<void> => {
    const element = selectedElement.value
    if (!element || element.type !== 'image') {
      return
    }

    const src = await fileToDataUri(file)
    updateSelectedProp('staticValue', src)
  }

  const clearPdfLabels = (): void => {
    state.pdf.fileName = null
    state.pdf.pageCount = 0
    state.pdf.pageWidthMm = 0
    state.pdf.pageHeightMm = 0
    state.pdf.pages = []
  }

  const loadPdfLabels = async (file: File): Promise<void> => {
    if (pdfLoading.value) {
      return
    }

    pdfLoading.value = true
    pdfLoadingText.value = 'Загрузка PDF...'

    try {
      const loaded = await loadPdfPages(file, (processedPages, totalPages) => {
        pdfLoadingText.value =
          totalPages > 0 ? `Загрузка PDF: ${processedPages}/${totalPages}` : 'Загрузка PDF...'
      })

      if (loaded.pageCount <= 0 || loaded.pageImages.length <= 0) {
        throw new Error('pdf_has_no_pages')
      }

      state.pdf.fileName = file.name
      state.pdf.pageCount = loaded.pageCount
      state.pdf.pageWidthMm = loaded.pageWidthMm > 0 ? roundMm(loaded.pageWidthMm) : 0
      state.pdf.pageHeightMm = loaded.pageHeightMm > 0 ? roundMm(loaded.pageHeightMm) : 0
      state.pdf.pages = loaded.pageImages

      for (let i = 0; i < state.elements.length; i += 1) {
        applyPdfSizeToImageElement(state.elements[i])
      }
    } catch {
      clearPdfLabels()
      alert('Не удалось прочитать PDF. Проверьте, что файл не поврежден и содержит страницы.')
    } finally {
      pdfLoading.value = false
      pdfLoadingText.value = ''
    }
  }

  const saveProject = (): void => {
    const payload = {
      labelWidthMm: state.labelWidthMm,
      labelHeightMm: state.labelHeightMm,
      manualLabelCount: state.manualLabelCount,
      printSheet: state.printSheet,
      elements: state.elements,
    }

    const link = document.createElement('a')
    link.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`
    link.download = `bitprint_project_${Date.now()}.json`
    link.click()
  }

  const applyProjectPayload = (data: SavedProjectPayload): void => {
    state.labelWidthMm = roundMm(data.labelWidthMm)
    state.labelHeightMm = roundMm(data.labelHeightMm)
    state.manualLabelCount = data.manualLabelCount
    state.printSheet = normalizePrintSheet(data.printSheet)
    clearCsv()

    clearPdfLabels()

    state.elements = data.elements
    state.selectedId = state.elements[0]?.id ?? null
  }

  const loadProjectPayload = (payload: unknown): boolean => {
    if (!isValidProjectPayload(payload)) {
      alert('Неподдерживаемый формат проекта. Загружайте только JSON, сохраненный этой версией редактора.')
      return false
    }

    applyProjectPayload(payload)
    return true
  }

  const loadProject = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as unknown
      return loadProjectPayload(data)
    } catch {
      alert('Неподдерживаемый формат проекта. Загружайте только JSON, сохраненный этой версией редактора.')
      return false
    }
  }

  const executeBatchPrint = async (container: HTMLElement): Promise<void> => {
    if (printInProgress.value || pdfLoading.value) {
      return
    }

    printInProgress.value = true
    printProgressText.value = 'Генерация...'

    try {
      await new Promise((resolve) => setTimeout(resolve, 50))

      container.innerHTML = ''

      const grid = calculatePrintGrid(state.labelWidthMm, state.labelHeightMm, state.printSheet)
      if (grid.labelsPerPage <= 0) {
        alert('Проверьте поля листа и отступы: в текущей конфигурации этикетки не помещаются на A4.')
        return
      }

      const rows = getCsvRows()
      const hasCsvFile = Boolean(state.csv.fileName)
      const csvRowsCount = rows.length
      const pdfPagesCount = state.pdf.pages.length
      if (hasCsvFile && pdfPagesCount > 0) {
        const mismatchWarning = getCsvPdfMismatchWarning(csvRowsCount, pdfPagesCount)
        if (mismatchWarning && !confirm(mismatchWarning)) {
          return
        }
      }

      const baseLabelCount = getBaseLabelCount(hasCsvFile, csvRowsCount, pdfPagesCount)
      const copiesPerLabel =
        !hasCsvFile && pdfPagesCount === 1 ? Math.max(1, Math.floor(state.manualLabelCount)) : 1
      const totalLabels = baseLabelCount * copiesPerLabel
      if (totalLabels <= 0) {
        alert('Нет данных для печати. Проверьте CSV или задайте количество вручную.')
        return
      }
      const totalPages = Math.ceil(totalLabels / grid.labelsPerPage)

      let renderedLabels = 0

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        const page = document.createElement('div')
        page.className = 'print-sheet'
        page.style.width = `${state.printSheet.pageWidthMm}mm`
        page.style.height = `${state.printSheet.pageHeightMm}mm`
        page.style.display = 'block'
        page.style.position = 'relative'
        page.style.overflow = 'hidden'
        page.style.background = '#fff'
        page.style.boxSizing = 'border-box'
        page.style.breakInside = 'avoid'
        page.style.pageBreakInside = 'avoid'
        page.style.breakAfter = pageIndex < totalPages - 1 ? 'page' : 'auto'
        page.style.pageBreakAfter = pageIndex < totalPages - 1 ? 'always' : 'auto'

        const pageStart = pageIndex * grid.labelsPerPage
        const pageEnd = Math.min(pageStart + grid.labelsPerPage, totalLabels)

        for (let labelIndex = pageStart; labelIndex < pageEnd; labelIndex += 1) {
          const cellIndex = labelIndex - pageStart
          const position = printCalibrationEnabled.value
            ? getCalibratedGridLabelPosition(
                cellIndex,
                grid,
                state.labelWidthMm,
                state.labelHeightMm,
                state.printSheet,
                printCalibration.value,
              )
            : getGridLabelPosition(
                cellIndex,
                grid,
                state.labelWidthMm,
                state.labelHeightMm,
                state.printSheet,
              )

          const labelBox = document.createElement('div')
          labelBox.className = 'print-label-box'
          labelBox.style.left = `${position.leftMm}mm`
          labelBox.style.top = `${position.topMm}mm`
          labelBox.style.width = `${state.labelWidthMm}mm`
          labelBox.style.height = `${state.labelHeightMm}mm`
          labelBox.style.position = 'absolute'
          labelBox.style.overflow = 'hidden'
          labelBox.style.background = '#fff'
          labelBox.style.boxSizing = 'border-box'
          if (debugPrintGridEnabled.value) {
            labelBox.style.outline = '0.25mm solid #ff00ff'
            labelBox.style.outlineOffset = '0'
          }

          const renderIndex = Math.floor(labelIndex / copiesPerLabel)
          const row = getCsvRowByRenderIndex(renderIndex, rows)
          const labelContent = createLabelDom(
            state.elements,
            (element) => getValue(element, row, renderIndex),
            {
              labelWidthMm: state.labelWidthMm,
              labelHeightMm: state.labelHeightMm,
            },
          )
          labelBox.appendChild(labelContent)

          page.appendChild(labelBox)

          renderedLabels += 1
          if (renderedLabels % 25 === 0 || renderedLabels === totalLabels) {
            printProgressText.value = `Генерация: ${renderedLabels} / ${totalLabels} (лист ${pageIndex + 1}/${totalPages})`
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
        }

        container.appendChild(page)
      }

      window.print()
    } finally {
      printProgressText.value = 'Печать A4'
      printInProgress.value = false
    }
  }

  return {
    state,
    selectedElement,
    printGrid,
    printInProgress,
    printProgressText,
    pdfLoading,
    pdfLoadingText,
    debugPrintGridEnabled,
    printCalibrationEnabled,
    printCalibration,
    initDefaults,
    setLabelSizeMm,
    updatePrintSheet,
    setDebugPrintGridEnabled,
    setPrintCalibrationEnabled,
    updatePrintCalibration,
    setManualLabelCount,
    addElement,
    deleteElement,
    selectElement,
    moveElement,
    updateSelectedProp,
    updateElement,
    getValue,
    clearCsv,
    loadCsv,
    loadImageForSelected,
    loadPdfLabels,
    clearPdfLabels,
    saveProject,
    loadProjectPayload,
    loadProject,
    executeBatchPrint,
  }
}

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(String(reader.result ?? ''))
    }
    reader.onerror = () => {
      reject(new Error('image_read_error'))
    }
    reader.readAsDataURL(file)
  })
}
