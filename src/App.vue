<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import CanvasWorkspace from './components/editor/CanvasWorkspace.vue'
import ToolbarHeader from './components/layout/ToolbarHeader.vue'
import LeftSidebar from './components/panels/LeftSidebar.vue'
import PropertiesPanel from './components/panels/PropertiesPanel.vue'
import type { LabelElement } from './domain/types'
import { useLabelEditor } from './composables/useLabelEditor'

const editor = useLabelEditor()
const printContainerRef = ref<HTMLDivElement | null>(null)

const printLabel = computed(() => {
  if (editor.pdfLoading.value) {
    return editor.pdfLoadingText.value || 'Загрузка PDF...'
  }

  if (editor.printInProgress.value) {
    return editor.printProgressText.value || 'Генерация...'
  }

  if (editor.state.pdf.pageCount > 0) {
    return 'Печать PDF → A4'
  }

  return 'Печать A4'
})

onMounted(() => {
  editor.initDefaults()
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

const onLoadPdf = async (file: File): Promise<void> => {
  await editor.loadPdfLabels(file)
}

const onLoadProject = async (file: File): Promise<void> => {
  await editor.loadProject(file)
}

const onLoadImage = async (file: File): Promise<void> => {
  await editor.loadImageForSelected(file)
}

const onClearPdf = (): void => {
  editor.clearPdfLabels()
}

const onPdfCopiesChange = (value: number): void => {
  editor.setPdfCopies(value)
}

const onPrint = async (): Promise<void> => {
  if (!printContainerRef.value) {
    return
  }

  await editor.executeBatchPrint(printContainerRef.value)
}
</script>

<template lang="pug">
.main-app
  ToolbarHeader(
    :label-width-mm='editor.state.labelWidthMm'
    :label-height-mm='editor.state.labelHeightMm'
    :print-in-progress='editor.printInProgress.value || editor.pdfLoading.value'
    :print-label='printLabel'
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
      :pdf-file-name='editor.state.pdf.fileName'
      :pdf-page-count='editor.state.pdf.pageCount'
      :pdf-copies='editor.state.pdf.copies'
      :pdf-loading='editor.pdfLoading.value'
      :pdf-loading-text='editor.pdfLoadingText.value'
      :print-sheet='editor.state.printSheet'
      :print-grid='editor.printGrid.value'
      @load-csv='onLoadCsv'
      @load-pdf='onLoadPdf'
      @clear-pdf='onClearPdf'
      @update-pdf-copies='onPdfCopiesChange'
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
      :selected-id='editor.state.selectedId'
      :get-value='editor.getValue'
      @select='editor.selectElement'
      @patch-element='onPatchElement'
    )

    PropertiesPanel(
      :selected-element='editor.selectedElement.value'
      :csv-headers='editor.state.csv.headers'
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
