import Papa from 'papaparse'
import { computed, reactive, ref } from 'vue'

import {
  DEFAULT_LABEL_MM,
  DEFAULT_PRINT_SHEET_SETTINGS,
  roundMm,
} from '../domain/constants'
import { buildBarcodeSvgMarkup } from '../domain/barcode'
import { createDefaultElements, createElementByType } from '../domain/factories'
import { loadPdfLabels as loadPdfPages } from '../domain/pdf'
import { calculatePrintGrid, getGridLabelPosition, normalizePrintSheet } from '../domain/print'
import type { EditorState, ElementType, LabelElement, PrintSheetSettings } from '../domain/types'
import { getElementValue, parseNumber } from '../domain/utils'

const NUMERIC_PROPS = new Set([
  'x',
  'y',
  'width',
  'height',
  'fontSize',
  'x1',
  'y1',
  'x2',
  'y2',
  'thickness',
])

const coercePropValue = (key: string, value: unknown): unknown => {
  if (NUMERIC_PROPS.has(key)) {
    return parseNumber(value, 0)
  }

  if (key === 'bold') {
    return value === true || value === 'true'
  }

  if (key === 'dataSource') {
    return value === 'dynamic' ? 'dynamic' : 'static'
  }

  return value
}

const parsePositiveFloat = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseNonNegativeFloat = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

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
  'staticValue',
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

interface SavedProjectPayload {
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

const isDataSource = (value: unknown): value is 'static' | 'dynamic' => {
  return value === 'static' || value === 'dynamic'
}

const isTextAlign = (value: unknown): value is 'left' | 'center' | 'right' => {
  return value === 'left' || value === 'center' || value === 'right'
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
    value.height > 0
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
      isString(value.staticValue)
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

const isValidProjectPayload = (value: unknown): value is SavedProjectPayload => {
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

const setAbsoluteMmBox = (
  element: HTMLElement,
  leftMm: number,
  topMm: number,
  widthMm: number,
  heightMm: number,
): void => {
  element.style.position = 'absolute'
  element.style.left = `${leftMm}mm`
  element.style.top = `${topMm}mm`
  element.style.width = `${widthMm}mm`
  element.style.height = `${heightMm}mm`
  element.style.boxSizing = 'border-box'
}

const createTextNode = (element: Extract<LabelElement, { type: 'text' }>, value: string): HTMLElement => {
  const node = document.createElement('div')
  setAbsoluteMmBox(node, element.x, element.y, element.width, element.height)
  node.style.whiteSpace = 'pre-wrap'
  node.style.wordBreak = 'break-word'
  node.style.overflow = 'hidden'
  node.style.fontFamily = 'Arial, sans-serif'
  node.style.fontSize = `${Math.max(0.1, element.fontSize)}mm`
  node.style.fontWeight = element.bold ? '700' : '400'
  node.style.lineHeight = '1.15'
  node.style.color = '#000'
  node.style.textAlign = element.align
  node.textContent = value
  return node
}

const createImageNode = (element: Extract<LabelElement, { type: 'image' }>, value: string): HTMLElement => {
  const node = document.createElement('img')
  setAbsoluteMmBox(node, element.x, element.y, element.width, element.height)
  node.style.objectFit = 'fill'
  node.style.display = 'block'
  node.draggable = false
  node.src = value
  return node
}

const createPdfLabelNode = (source: string): HTMLElement => {
  const node = document.createElement('img')
  node.style.width = '100%'
  node.style.height = '100%'
  node.style.objectFit = 'contain'
  node.style.display = 'block'
  node.style.background = '#fff'
  node.draggable = false
  node.src = source
  return node
}

const createLineNode = (element: Extract<LabelElement, { type: 'line' }>): HTMLElement => {
  const node = document.createElement('div')
  const dx = element.x2 - element.x1
  const dy = element.y2 - element.y1
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  node.style.position = 'absolute'
  node.style.left = `${element.x1}mm`
  node.style.top = `${element.y1 - element.thickness / 2}mm`
  node.style.width = `${Math.max(0.01, length)}mm`
  node.style.height = `${Math.max(0.01, element.thickness)}mm`
  node.style.background = '#000'
  node.style.transformOrigin = '0 50%'
  node.style.transform = `rotate(${angle}deg)`

  return node
}

const createBarcodeNode = (element: Extract<LabelElement, { type: 'code' }>, value: string): HTMLElement => {
  const wrapper = document.createElement('div')
  setAbsoluteMmBox(wrapper, element.x, element.y, element.width, element.height)
  wrapper.style.display = 'flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.justifyContent = 'center'
  wrapper.style.overflow = 'hidden'

  const svgMarkup = buildBarcodeSvgMarkup(element, value)
  if (svgMarkup) {
    const parser = new DOMParser()
    const parsed = parser.parseFromString(svgMarkup, 'image/svg+xml')
    const svg = parsed.documentElement as unknown as SVGSVGElement

    svg.style.display = 'block'

    wrapper.appendChild(svg)
  }

  return wrapper
}

const createLabelDom = (elements: LabelElement[], getValue: (element: LabelElement) => string): HTMLElement => {
  const root = document.createElement('div')
  root.className = 'print-label-root'
  root.style.position = 'relative'
  root.style.width = '100%'
  root.style.height = '100%'
  root.style.overflow = 'hidden'
  root.style.background = '#fff'

  for (let i = 0; i < elements.length; i += 1) {
    const element = elements[i]
    const value = getValue(element)

    if (element.type === 'text') {
      root.appendChild(createTextNode(element, value))
      continue
    }

    if (element.type === 'image') {
      root.appendChild(createImageNode(element, value))
      continue
    }

    if (element.type === 'line') {
      root.appendChild(createLineNode(element))
      continue
    }

    root.appendChild(createBarcodeNode(element, value))
  }

  return root
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
      pages: [],
      copies: 1,
    },
  })

  const printInProgress = ref(false)
  const printProgressText = ref('Печать A4')
  const pdfLoading = ref(false)
  const pdfLoadingText = ref('')

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

  const setManualLabelCount = (count: unknown): void => {
    const normalized = Math.floor(parsePositiveFloat(count, state.manualLabelCount))
    state.manualLabelCount = Math.max(1, normalized)
  }

  const setPdfCopies = (count: unknown): void => {
    const normalized = Math.floor(parsePositiveFloat(count, state.pdf.copies))
    state.pdf.copies = Math.max(1, normalized)
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

  const updateSelectedProp = (key: string, value: unknown): void => {
    const element = selectedElement.value
    if (!element) {
      return
    }

    const normalized = coercePropValue(key, value)
    ;(element as unknown as Record<string, unknown>)[key] = normalized
  }

  const updateElement = (id: string, patch: Partial<LabelElement>): void => {
    const element = state.elements.find((item) => item.id === id)
    if (!element) {
      return
    }

    Object.assign(element as unknown as Record<string, unknown>, patch as Record<string, unknown>)
  }

  const getValue = (element: LabelElement, csvRow: string[] | null = null): string => {
    return getElementValue(element, state.csv.data, csvRow)
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
      state.pdf.pages = loaded.pageImages

      if (loaded.pageWidthMm > 0 && loaded.pageHeightMm > 0) {
        state.labelWidthMm = roundMm(loaded.pageWidthMm)
        state.labelHeightMm = roundMm(loaded.pageHeightMm)
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
      pdfCopies: state.pdf.copies,
      elements: state.elements,
    }

    const link = document.createElement('a')
    link.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`
    link.download = `bitprint_project_${Date.now()}.json`
    link.click()
  }

  const loadProject = async (file: File): Promise<void> => {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as unknown
      if (!isValidProjectPayload(data)) {
        throw new Error('invalid_project_payload')
      }

      state.labelWidthMm = roundMm(data.labelWidthMm)
      state.labelHeightMm = roundMm(data.labelHeightMm)
      state.manualLabelCount = data.manualLabelCount
      state.pdf.copies = data.pdfCopies
      state.printSheet = normalizePrintSheet(data.printSheet)
      state.csv.fileName = null
      state.csv.data = []
      state.csv.headers = []

      clearPdfLabels()

      state.elements = data.elements
      state.selectedId = state.elements[0]?.id ?? null
    } catch {
      alert('Неподдерживаемый формат проекта. Загружайте только JSON, сохраненный этой версией редактора.')
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

      const hasPdfMode = state.pdf.pages.length > 0
      const pdfCopies = Math.max(1, Math.floor(state.pdf.copies))
      const rows =
        state.csv.data.length > 1
          ? state.csv.data.slice(1)
          : Array.from({ length: state.manualLabelCount }, () => null)
      const totalLabels = hasPdfMode ? state.pdf.pages.length * pdfCopies : Math.max(1, rows.length)
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
          const position = getGridLabelPosition(
            cellIndex,
            grid.columns,
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

          if (hasPdfMode) {
            const sourcePageIndex = Math.floor(labelIndex / pdfCopies)
            const pageImage = state.pdf.pages[sourcePageIndex] ?? ''
            labelBox.appendChild(createPdfLabelNode(pageImage))
          } else {
            const row = rows[labelIndex] ?? null
            const labelContent = createLabelDom(state.elements, (element) => getValue(element, row))
            labelBox.appendChild(labelContent)
          }

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
    initDefaults,
    setLabelSizeMm,
    updatePrintSheet,
    setManualLabelCount,
    setPdfCopies,
    addElement,
    deleteElement,
    selectElement,
    updateSelectedProp,
    updateElement,
    getValue,
    loadCsv,
    loadImageForSelected,
    loadPdfLabels,
    clearPdfLabels,
    saveProject,
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
