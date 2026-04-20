import Papa from 'papaparse'
import { computed, reactive, ref } from 'vue'

import {
  DEFAULT_LABEL_MM,
  DEFAULT_PRINT_SHEET_SETTINGS,
  roundMm,
} from '../domain/constants'
import { buildBarcodeSvgMarkup } from '../domain/barcode'
import { createDefaultElements, createElementByType, normalizeLoadedElement } from '../domain/factories'
import { calculatePrintGrid, getGridLabelPosition, normalizePrintSheet } from '../domain/print'
import type { EditorState, ElementType, LabelElement, LineElement, PrintSheetSettings } from '../domain/types'
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

const PROJECT_VERSION = 2

const syncLineDimensions = (element: LineElement): void => {
  element.width = roundMm(Math.max(0.01, Math.abs(element.x2 - element.x1)))
  element.height = roundMm(Math.max(0.01, Math.abs(element.y2 - element.y1)))
}

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
    printSheet: { ...DEFAULT_PRINT_SHEET_SETTINGS },
    elements: [],
    selectedId: null,
    csv: {
      headers: [],
      data: [],
    },
  })

  const printInProgress = ref(false)
  const printProgressText = ref('Печать A4')

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

    if (element.type === 'line' && ['x1', 'y1', 'x2', 'y2'].includes(key)) {
      syncLineDimensions(element)
    }
  }

  const updateElement = (id: string, patch: Partial<LabelElement>): void => {
    const element = state.elements.find((item) => item.id === id)
    if (!element) {
      return
    }

    Object.assign(element as unknown as Record<string, unknown>, patch as Record<string, unknown>)
    if (element.type === 'line') {
      syncLineDimensions(element)
    }
  }

  const getValue = (element: LabelElement, csvRow: string[] | null = null): string => {
    return getElementValue(element, state.csv.data, csvRow)
  }

  const loadCsv = async (file: File): Promise<void> => {
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

  const saveProject = (): void => {
    const payload = {
      version: PROJECT_VERSION,
      labelWidthMm: state.labelWidthMm,
      labelHeightMm: state.labelHeightMm,
      printSheet: state.printSheet,
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
      const data = JSON.parse(text) as {
        version?: number
        labelWidthMm?: number
        labelHeightMm?: number
        printSheet?: Partial<PrintSheetSettings>
        elements?: Record<string, unknown>[]
      }

      if (data.version !== PROJECT_VERSION) {
        throw new Error('unsupported_project_version')
      }

      const nextLabelWidthMm = parsePositiveFloat(data.labelWidthMm, DEFAULT_LABEL_MM.width)
      const nextLabelHeightMm = parsePositiveFloat(data.labelHeightMm, DEFAULT_LABEL_MM.height)

      state.labelWidthMm = roundMm(nextLabelWidthMm)
      state.labelHeightMm = roundMm(nextLabelHeightMm)
      state.printSheet = mergePrintSheet(DEFAULT_PRINT_SHEET_SETTINGS, data.printSheet ?? {})

      if (Array.isArray(data.elements)) {
        const normalized = data.elements
          .map((item) => normalizeLoadedElement(item))
          .filter((item): item is LabelElement => item !== null)

        state.elements = normalized
        state.selectedId = state.elements[0]?.id ?? null
      }
    } catch {
      alert('Неподдерживаемый формат проекта. Сохраняйте и загружайте только новые проекты v2.')
    }
  }

  const executeBatchPrint = async (container: HTMLElement): Promise<void> => {
    if (printInProgress.value) {
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

      const rows = state.csv.data.length > 1 ? state.csv.data.slice(1) : [null]
      const totalLabels = Math.max(1, rows.length)
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
          const row = rows[labelIndex] ?? null

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

          const labelContent = createLabelDom(state.elements, (element) => getValue(element, row))
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
    initDefaults,
    setLabelSizeMm,
    updatePrintSheet,
    addElement,
    deleteElement,
    selectElement,
    updateSelectedProp,
    updateElement,
    getValue,
    loadCsv,
    loadImageForSelected,
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
