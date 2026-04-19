import Papa from 'papaparse'
import { computed, reactive, ref } from 'vue'

import { DEFAULT_LABEL_SIZE, DOTS_PER_MM } from '../domain/constants'
import { createDefaultElements, createElementByType, normalizeLoadedElement } from '../domain/factories'
import { renderElement } from '../domain/rasterizer'
import type { EditorState, ElementType, LabelElement, LineElement } from '../domain/types'
import { getElementBox, getElementValue, parseNumber } from '../domain/utils'

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

const syncLineDimensions = (element: LineElement): void => {
  element.width = Math.max(1, Math.abs(element.x2 - element.x1))
  element.height = Math.max(1, Math.abs(element.y2 - element.y1))
}

const coercePropValue = (key: string, value: unknown): unknown => {
  if (NUMERIC_PROPS.has(key)) {
    return parseNumber(value, 1)
  }

  if (key === 'bold') {
    return value === true || value === 'true'
  }

  if (key === 'dataSource') {
    return value === 'dynamic' ? 'dynamic' : 'static'
  }

  return value
}

export const useLabelEditor = () => {
  const state = reactive<EditorState>({
    width: DEFAULT_LABEL_SIZE.width,
    height: DEFAULT_LABEL_SIZE.height,
    elements: [],
    selectedId: null,
    csv: {
      headers: [],
      data: [],
    },
  })

  const printInProgress = ref(false)
  const printProgressText = ref('Матричная Печать')

  const selectedElement = computed<LabelElement | null>(() => {
    return state.elements.find((element) => element.id === state.selectedId) ?? null
  })

  const mmSize = computed(() => {
    return {
      width: (state.width / DOTS_PER_MM).toFixed(1),
      height: (state.height / DOTS_PER_MM).toFixed(1),
    }
  })

  const initDefaults = (): void => {
    state.elements = createDefaultElements()
    state.selectedId = state.elements[0]?.id ?? null
  }

  const setCanvasSize = (width: unknown, height: unknown): void => {
    state.width = Math.max(1, parseNumber(width, DEFAULT_LABEL_SIZE.width))
    state.height = Math.max(1, parseNumber(height, DEFAULT_LABEL_SIZE.height))
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
      width: state.width,
      height: state.height,
      elements: state.elements,
    }

    const link = document.createElement('a')
    link.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`
    link.download = `pixel_label_${Date.now()}.json`
    link.click()
  }

  const loadProject = async (file: File): Promise<void> => {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as {
        width?: number
        height?: number
        elements?: Record<string, unknown>[]
      }

      setCanvasSize(data.width ?? DEFAULT_LABEL_SIZE.width, data.height ?? DEFAULT_LABEL_SIZE.height)

      if (Array.isArray(data.elements)) {
        const normalized = data.elements
          .map((item) => normalizeLoadedElement(item))
          .filter((item): item is LabelElement => item !== null)

        state.elements = normalized
        state.selectedId = state.elements[0]?.id ?? null
      }
    } catch {
      alert('Ошибка файла проекта.')
    }
  }

  const executeBatchPrint = async (container: HTMLElement): Promise<void> => {
    if (printInProgress.value) {
      return
    }

    printInProgress.value = true
    printProgressText.value = 'Генерация...'

    await new Promise((resolve) => setTimeout(resolve, 50))

    container.innerHTML = ''
    const rowCount = Math.max(1, state.csv.data.length - 1)

    for (let index = 0; index < rowCount; index += 1) {
      const csvRow = state.csv.data.length > 1 ? state.csv.data[index + 1] : null

      const output = document.createElement('canvas')
      output.width = state.width
      output.height = state.height
      const ctx = output.getContext('2d')
      if (!ctx) {
        continue
      }

      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, output.width, output.height)

      for (let elementIndex = 0; elementIndex < state.elements.length; elementIndex += 1) {
        const element = state.elements[elementIndex]
        const value = getValue(element, csvRow)

        try {
          const rendered = await renderElement(element, value)
          if (!rendered) {
            continue
          }

          const box = getElementBox(element)
          ctx.drawImage(rendered, box.left, box.top)
        } catch {
          // Continue rendering remaining elements.
        }
      }

      const page = document.createElement('div')
      page.className = 'print-label-box'
      page.appendChild(output)
      container.appendChild(page)

      if (index > 0 && index % 50 === 0) {
        printProgressText.value = `Генерация: ${index} / ${rowCount}`
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }

    printProgressText.value = 'Матричная Печать'
    printInProgress.value = false
    window.print()
  }

  return {
    state,
    selectedElement,
    mmSize,
    printInProgress,
    printProgressText,
    initDefaults,
    setCanvasSize,
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
