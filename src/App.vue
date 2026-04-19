<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import CanvasWorkspace from './components/editor/CanvasWorkspace.vue'
import ToolbarHeader from './components/layout/ToolbarHeader.vue'
import LeftSidebar from './components/panels/LeftSidebar.vue'
import PropertiesPanel from './components/panels/PropertiesPanel.vue'
import { dotsToMm } from './domain/constants'
import type { LabelElement } from './domain/types'
import { useLabelEditor } from './composables/useLabelEditor'

const editor = useLabelEditor()
const printContainerRef = ref<HTMLDivElement | null>(null)

const printLabel = computed(() => {
  if (editor.printInProgress.value) {
    return editor.printProgressText.value || 'Генерация...'
  }

  return 'Матричная Печать'
})

onMounted(() => {
  editor.initDefaults()
})

watch(
  () => [editor.state.width, editor.state.height, editor.state.dpi],
  ([width, height, dpi]) => {
    const mmW = dotsToMm(width, dpi).toFixed(1)
    const mmH = dotsToMm(height, dpi).toFixed(1)

    let style = document.getElementById('print-style') as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = 'print-style'
      document.head.appendChild(style)
    }

    style.innerHTML = `@media print { @page { size: ${mmW}mm ${mmH}mm; margin: 0; } .print-label-box { width: ${mmW}mm !important; height: ${mmH}mm !important; transform-origin: top left; } .print-label-box canvas { width: 100% !important; height: 100% !important; image-rendering: pixelated; } }`
  },
  { immediate: true },
)

const onPatchElement = (payload: { id: string; patch: Partial<LabelElement> }): void => {
  editor.updateElement(payload.id, payload.patch)
}

const onLoadCsv = async (file: File): Promise<void> => {
  await editor.loadCsv(file)
}

const onLoadProject = async (file: File): Promise<void> => {
  await editor.loadProject(file)
}

const onLoadImage = async (file: File): Promise<void> => {
  await editor.loadImageForSelected(file)
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
    :dpi='editor.state.dpi'
    :width='editor.state.width'
    :height='editor.state.height'
    :print-in-progress='editor.printInProgress.value'
    :print-label='printLabel'
    @update-dpi='editor.setDpi'
    @update-size='editor.setCanvasSize($event.width, $event.height)'
    @add-element='editor.addElement'
    @save-project='editor.saveProject()'
    @load-project='onLoadProject'
    @print='onPrint'
  )

  .app-body#ui-container
    LeftSidebar(
      :elements='editor.state.elements'
      :selected-id='editor.state.selectedId'
      @load-csv='onLoadCsv'
      @select-layer='editor.selectElement'
      @delete-layer='editor.deleteElement'
    )

    CanvasWorkspace(
      :dpi='editor.state.dpi'
      :width='editor.state.width'
      :height='editor.state.height'
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
  .main-app > :not(#print-batch-container) {
    display: none !important;
  }

  #print-batch-container {
    display: block !important;
    margin: 0;
    padding: 0;
    width: 100%;
  }

  .print-label-box {
    background: #fff;
    border: 0;
    box-shadow: none;
    box-sizing: border-box;
    margin: 0;
    overflow: hidden;
    page-break-after: always;
    position: relative;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    box-sizing: border-box !important;
    print-color-adjust: exact !important;
  }

  canvas {
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }
}
</style>
