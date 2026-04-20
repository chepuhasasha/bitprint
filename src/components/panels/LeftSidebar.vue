<script setup lang="ts">
import LayersList from './LayersList.vue'
import type { PrintGrid } from '../../domain/print'
import type { LabelElement, PrintSheetSettings } from '../../domain/types'

defineProps<{
  elements: LabelElement[]
  selectedId: string | null
  manualLabelCount: number
  hasCsv: boolean
  printSheet: PrintSheetSettings
  printGrid: PrintGrid
}>()

const emit = defineEmits<{
  (event: 'load-csv', payload: File): void
  (event: 'select-layer', payload: string): void
  (event: 'delete-layer', payload: string): void
  (event: 'update-print-sheet', payload: Partial<PrintSheetSettings>): void
  (event: 'update-manual-label-count', payload: number): void
}>()

const onCsvSelected = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  emit('load-csv', file)
}

const onPrintNumberChange = (key: keyof PrintSheetSettings, event: Event): void => {
  const target = event.target as HTMLInputElement
  emit('update-print-sheet', {
    [key]: Number(target.value),
  })
}

const onManualCountChange = (event: Event): void => {
  const target = event.target as HTMLInputElement
  emit('update-manual-label-count', Number(target.value))
}
</script>

<template lang="pug">
aside.left-sidebar
  h2.panel-title База данных (CSV)
  input.csv-input(type='file' accept='.csv,.txt' @change='onCsvSelected')
  label.manual-count(v-if='!hasCsv')
    span Кол-во без CSV
    input(type='number' min='1' step='1' :value='manualLabelCount' @change='onManualCountChange')

  h2.panel-title Параметры A4 (мм)
  .print-sheet-settings
    .field-group
      label.field
        span Страница, Ш
        input(type='number' step='0.01' min='1' :value='printSheet.pageWidthMm' @change='onPrintNumberChange("pageWidthMm", $event)')
      label.field
        span Страница, В
        input(type='number' step='0.01' min='1' :value='printSheet.pageHeightMm' @change='onPrintNumberChange("pageHeightMm", $event)')

    .field-group
      label.field
        span Поле слева
        input(type='number' step='0.01' min='0' :value='printSheet.marginLeftMm' @change='onPrintNumberChange("marginLeftMm", $event)')
      label.field
        span Поле справа
        input(type='number' step='0.01' min='0' :value='printSheet.marginRightMm' @change='onPrintNumberChange("marginRightMm", $event)')
      label.field
        span Поле сверху
        input(type='number' step='0.01' min='0' :value='printSheet.marginTopMm' @change='onPrintNumberChange("marginTopMm", $event)')
      label.field
        span Поле снизу
        input(type='number' step='0.01' min='0' :value='printSheet.marginBottomMm' @change='onPrintNumberChange("marginBottomMm", $event)')

    .field-group
      label.field
        span Гор. отступ
        input(type='number' step='0.01' min='0' :value='printSheet.gapHorizontalMm' @change='onPrintNumberChange("gapHorizontalMm", $event)')
      label.field
        span Вер. отступ
        input(type='number' step='0.01' min='0' :value='printSheet.gapVerticalMm' @change='onPrintNumberChange("gapVerticalMm", $event)')

    p.grid-info(v-if='printGrid.labelsPerPage > 0') Сетка: {{ printGrid.columns }} × {{ printGrid.rows }} ({{ printGrid.labelsPerPage }} шт./лист)
    p.grid-info.grid-info--warn(v-else) Этикетка не помещается при текущих полях/отступах

  h2.panel-title Слои
  .layers-wrapper
    LayersList(
      :elements='elements'
      :selected-id='selectedId'
      @select='emit("select-layer", $event)'
      @delete='emit("delete-layer", $event)'
    )
</template>

<style scoped lang="scss">
.left-sidebar {
  background: #f8fafc;
  border-right: 1px solid #dbe2ea;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 0.65rem;
  padding: 0.9rem;
  width: 16rem;
}

.panel-title {
  color: #475569;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  margin: 0;
  text-transform: uppercase;
}

.csv-input {
  background: #fff;
  border: 1px solid #dbe2ea;
  border-radius: 0.4rem;
  font-size: 0.72rem;
  padding: 0.25rem;
}

.csv-input::file-selector-button {
  background: #dbeafe;
  border: 0;
  border-radius: 0.3rem;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 700;
  margin-right: 0.4rem;
  padding: 0.25rem 0.4rem;
}

.manual-count {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.manual-count span {
  color: #475569;
  font-size: 0.72rem;
  font-weight: 700;
}

.manual-count input {
  border: 1px solid #cbd5e1;
  border-radius: 0.35rem;
  font-size: 0.78rem;
  padding: 0.3rem 0.4rem;
}

.print-sheet-settings {
  background: #fff;
  border: 1px solid #dbe2ea;
  border-radius: 0.45rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.55rem;
}

.field-group {
  display: grid;
  gap: 0.4rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.field span {
  color: #64748b;
  font-size: 0.68rem;
}

.field input {
  border: 1px solid #cbd5e1;
  border-radius: 0.35rem;
  font-size: 0.75rem;
  padding: 0.26rem 0.35rem;
}

.grid-info {
  color: #0f766e;
  font-size: 0.74rem;
  font-weight: 700;
  margin: 0.1rem 0 0;
}

.grid-info--warn {
  color: #b45309;
}

.layers-wrapper {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

@media (max-width: 960px) {
  .left-sidebar {
    border-bottom: 1px solid #dbe2ea;
    border-right: 0;
    width: 100%;
  }
}
</style>
