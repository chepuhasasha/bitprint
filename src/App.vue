<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import CanvasWorkspace from './components/editor/CanvasWorkspace.vue'
import ToolbarHeader from './components/layout/ToolbarHeader.vue'
import LeftSidebar from './components/panels/LeftSidebar.vue'
import PropertiesPanel from './components/panels/PropertiesPanel.vue'
import type { LabelElement } from './domain/types'
import { useLabelEditor } from './composables/useLabelEditor'

interface PresetIndexEntry {
  name: string
  code: string
  url: string
  file: string
  labelsPerSheet: number | null
}

const editor = useLabelEditor()
const printContainerRef = ref<HTMLDivElement | null>(null)
const presets = ref<PresetIndexEntry[]>([])
const presetsLoading = ref(false)
const presetsError = ref('')
const presetApplying = ref(false)
const resetToken = ref(0)

const printLabel = computed(() => {
  if (editor.pdfLoading.value) {
    return editor.pdfLoadingText.value || 'Загрузка PDF...'
  }

  if (editor.printInProgress.value) {
    return editor.printProgressText.value || 'Генерация...'
  }

  return 'Печать A4'
})

const csvDataRowCount = computed(() => Math.max(0, editor.state.csv.data.length - 1))

onMounted(() => {
  editor.initDefaults()
  void loadPresetsIndex()
})

watch(
  () => [editor.state.printSheet.pageWidthMm, editor.state.printSheet.pageHeightMm],
  ([pageWidthMm, pageHeightMm]) => {
    let style = document.getElementById('print-style') as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = 'print-style'
      document.head.appendChild(style)
    }

    style.innerHTML = `@media print { @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; } #print-batch-container { width: ${pageWidthMm}mm !important; } .print-sheet { width: ${pageWidthMm}mm !important; height: ${pageHeightMm}mm !important; } }`
  },
  { immediate: true },
)

const onPatchElement = (payload: { id: string; patch: Partial<LabelElement> }): void => {
  editor.updateElement(payload.id, payload.patch)
}

const onLoadCsv = async (file: File): Promise<void> => {
  await editor.loadCsv(file)
}

const onClearCsv = (): void => {
  editor.clearCsv()
}

const onLoadPdf = async (file: File): Promise<void> => {
  await editor.loadPdfLabels(file)
}

const onLoadProject = async (file: File): Promise<void> => {
  const loaded = await editor.loadProject(file)
  if (loaded) {
    resetToken.value += 1
  }
}

const onLoadImage = async (file: File): Promise<void> => {
  await editor.loadImageForSelected(file)
}

const onClearPdf = (): void => {
  editor.clearPdfLabels()
}

const onPrint = async (): Promise<void> => {
  if (!printContainerRef.value) {
    return
  }

  await editor.executeBatchPrint(printContainerRef.value)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const deriveLabelsPerSheet = (item: Record<string, unknown>): number | null => {
  const explicit = toPositiveNumber(item.labelsPerSheet)
  if (explicit !== null) {
    return explicit
  }

  if (!Array.isArray(item.prices)) {
    return null
  }

  const ratioCounts = new Map<string, { value: number; count: number }>()

  for (const entry of item.prices) {
    if (!isRecord(entry)) {
      continue
    }

    const labels = toPositiveNumber(entry.labels)
    const sheets = toPositiveNumber(entry.sheets)
    if (labels === null || sheets === null) {
      continue
    }

    const ratio = Math.round((labels / sheets) * 10_000) / 10_000
    if (!Number.isFinite(ratio) || ratio <= 0) {
      continue
    }

    const key = String(ratio)
    const current = ratioCounts.get(key)
    if (current) {
      current.count += 1
    } else {
      ratioCounts.set(key, { value: ratio, count: 1 })
    }
  }

  let selected: { value: number; count: number } | null = null
  for (const candidate of ratioCounts.values()) {
    if (!selected || candidate.count > selected.count) {
      selected = candidate
    }
  }

  return selected ? selected.value : null
}

const loadPresetsIndex = async (): Promise<void> => {
  presetsLoading.value = true
  presetsError.value = ''

  try {
    const response = await fetch('/presets/index.json', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`presets_index_http_${response.status}`)
    }

    const data = (await response.json()) as unknown
    if (!Array.isArray(data)) {
      throw new Error('presets_index_invalid')
    }

    const nextPresets = data
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item) => {
        return {
          name: String(item.name ?? '').trim(),
          code: String(item.code ?? '').trim(),
          url: String(item.url ?? '').trim(),
          file: String(item.file ?? '').trim(),
          labelsPerSheet: deriveLabelsPerSheet(item),
        }
      })
      .filter((item) => item.name.length > 0 && item.file.length > 0)

    presets.value = nextPresets
  } catch {
    presets.value = []
    presetsError.value = 'Не удалось загрузить список пресетов.'
  } finally {
    presetsLoading.value = false
  }
}

const onApplyPreset = async (fileName: string): Promise<void> => {
  if (!fileName || presetApplying.value) {
    return
  }

  presetApplying.value = true

  try {
    const response = await fetch(`/presets/${encodeURIComponent(fileName)}`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`preset_http_${response.status}`)
    }

    const payload = (await response.json()) as unknown
    const applied = editor.loadProjectPayload(payload)
    if (applied) {
      resetToken.value += 1
    }
  } catch {
    alert('Не удалось загрузить пресет. Проверьте, что файл доступен в public/presets.')
  } finally {
    presetApplying.value = false
  }
}
</script>

<template lang="pug">
.main-app
  ToolbarHeader(
    :label-width-mm='editor.state.labelWidthMm'
    :label-height-mm='editor.state.labelHeightMm'
    :print-in-progress='editor.printInProgress.value || editor.pdfLoading.value'
    :print-label='printLabel'
    :reset-token='resetToken'
    @update-label-size='editor.setLabelSizeMm($event.widthMm, $event.heightMm)'
    @add-element='editor.addElement'
    @save-project='editor.saveProject()'
    @load-project='onLoadProject'
    @print='onPrint'
  )

  .app-body#ui-container
    LeftSidebar(
      :elements='editor.state.elements'
      :selected-id='editor.state.selectedId'
      :manual-label-count='editor.state.manualLabelCount'
      :has-csv='Boolean(editor.state.csv.fileName)'
      :csv-row-count='csvDataRowCount'
      :pdf-file-name='editor.state.pdf.fileName'
      :pdf-page-count='editor.state.pdf.pageCount'
      :pdf-loading='editor.pdfLoading.value'
      :pdf-loading-text='editor.pdfLoadingText.value'
      :print-sheet='editor.state.printSheet'
      :print-grid='editor.printGrid.value'
      :presets='presets'
      :presets-loading='presetsLoading'
      :presets-error='presetsError'
      :preset-applying='presetApplying'
      :reset-token='resetToken'
      @load-csv='onLoadCsv'
      @clear-csv='onClearCsv'
      @load-pdf='onLoadPdf'
      @clear-pdf='onClearPdf'
      @reload-presets='loadPresetsIndex'
      @apply-preset='onApplyPreset'
      @select-layer='editor.selectElement'
      @delete-layer='editor.deleteElement'
      @update-print-sheet='editor.updatePrintSheet'
      @update-manual-label-count='editor.setManualLabelCount'
    )

    CanvasWorkspace(
      :label-width-mm='editor.state.labelWidthMm'
      :label-height-mm='editor.state.labelHeightMm'
      :elements='editor.state.elements'
      :csv-data='editor.state.csv.data'
      :pdf-pages='editor.state.pdf.pages'
      :selected-id='editor.state.selectedId'
      :get-value='editor.getValue'
      @select='editor.selectElement'
      @patch-element='onPatchElement'
    )

    PropertiesPanel(
      :selected-element='editor.selectedElement.value'
      :csv-headers='editor.state.csv.headers'
      :reset-token='resetToken'
      @update-prop='editor.updateSelectedProp'
      @load-image='onLoadImage'
    )

  #print-batch-container(ref='printContainerRef')
</template>

<style scoped lang="scss">
.main-app {
  color: #1f2937;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

#print-batch-container {
  display: none;
}

@media (max-width: 960px) {
  .app-body {
    flex-direction: column;
    overflow: auto;
  }
}

@media print {
  html,
  body,
  #app,
  .main-app {
    height: auto !important;
    overflow: visible !important;
  }

  .main-app > :not(#print-batch-container) {
    display: none !important;
  }

  #print-batch-container {
    display: block !important;
    margin: 0;
    overflow: visible !important;
    padding: 0;
  }

  .print-sheet {
    background: #fff;
    box-sizing: border-box;
    margin: 0;
    overflow: hidden;
    page-break-after: always;
    position: relative;
  }

  .print-sheet:last-child {
    page-break-after: auto;
  }

  .print-label-box {
    background: #fff;
    overflow: hidden;
    position: absolute;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    box-sizing: border-box !important;
    print-color-adjust: exact !important;
  }
}
</style>
