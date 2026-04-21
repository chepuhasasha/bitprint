<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import LayersList from './LayersList.vue'
import type { PrintGrid } from '../../domain/print'
import type { LabelElement, PrintSheetSettings } from '../../domain/types'

interface PresetListEntry {
  name: string
  code: string
  url: string
  file: string
  labelsPerSheet: number | null
}

const props = defineProps<{
  elements: LabelElement[]
  selectedId: string | null
  manualLabelCount: number
  hasCsv: boolean
  pdfFileName: string | null
  pdfPageCount: number
  pdfLoading: boolean
  pdfLoadingText: string
  printSheet: PrintSheetSettings
  printGrid: PrintGrid
  presets: PresetListEntry[]
  presetsLoading: boolean
  presetsError: string
  presetApplying: boolean
  resetToken: number
}>()

const csvInputRef = ref<HTMLInputElement | null>(null)
const pdfInputRef = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  (event: 'load-csv', payload: File): void
  (event: 'load-pdf', payload: File): void
  (event: 'clear-pdf'): void
  (event: 'select-layer', payload: string): void
  (event: 'delete-layer', payload: string): void
  (event: 'update-print-sheet', payload: Partial<PrintSheetSettings>): void
  (event: 'update-manual-label-count', payload: number): void
  (event: 'reload-presets'): void
  (event: 'apply-preset', payload: string): void
}>()

const onCsvSelected = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  emit('load-csv', file)
}

const onPdfSelected = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  emit('load-pdf', file)
}

const onClearPdf = (): void => {
  emit('clear-pdf')
  if (pdfInputRef.value) {
    pdfInputRef.value.value = ''
  }
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

const hasPdfFile = computed(() => Boolean(props.pdfFileName))
const showCountInput = computed(() => (!props.hasCsv && !hasPdfFile.value) || (hasPdfFile.value && props.pdfPageCount <= 1))
const countLabel = computed(() => (!props.hasCsv && !hasPdfFile.value ? 'Количество' : 'Копий'))

const presetsModalOpen = ref(false)
const presetSearch = ref('')

const normalizedSearch = computed(() => presetSearch.value.trim().toLowerCase())
const filteredPresets = computed(() => {
  const query = normalizedSearch.value
  if (!query) {
    return props.presets
  }

  return props.presets.filter((preset) => {
    const name = preset.name.toLowerCase()
    const code = preset.code.toLowerCase()
    return name.includes(query) || code.includes(query)
  })
})

const labelsFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
})

const formatLabelsPerSheet = (preset: PresetListEntry): string => {
  const count = preset.labelsPerSheet

  if (count == null || !Number.isFinite(count) || count <= 0) {
    return '— шт./лист'
  }

  return `${labelsFormatter.format(count)} шт./лист`
}

const onOpenPresetsModal = (): void => {
  presetsModalOpen.value = true
  presetSearch.value = ''
  if (props.presets.length === 0 && !props.presetsLoading) {
    emit('reload-presets')
  }
}

const onClosePresetsModal = (): void => {
  presetsModalOpen.value = false
}

const onApplyPreset = (fileName: string): void => {
  if (!fileName) {
    return
  }
  emit('apply-preset', fileName)
  presetsModalOpen.value = false
}

watch(
  () => props.resetToken,
  () => {
    if (csvInputRef.value) {
      csvInputRef.value.value = ''
    }
    if (pdfInputRef.value) {
      pdfInputRef.value.value = ''
    }
    presetSearch.value = ''
    presetsModalOpen.value = false
  },
)
</script>

<template lang="pug">
aside.left-sidebar
  h2.panel-title База данных (CSV)
  input.csv-input(ref='csvInputRef' type='file' accept='.csv,.txt' @change='onCsvSelected')

  h2.panel-title PDF этикетки
  input.csv-input(ref='pdfInputRef' type='file' accept='.pdf,application/pdf' :disabled='pdfLoading' @change='onPdfSelected')
  p.pdf-loading(v-if='pdfLoading') {{ pdfLoadingText || 'Загрузка PDF...' }}
  p.pdf-meta(v-else-if='pdfFileName') {{ pdfFileName }} ({{ pdfPageCount }} стр.)
  label.manual-count(v-if='showCountInput')
    span {{ countLabel }}
    input(type='number' min='1' step='1' :value='manualLabelCount' :disabled='pdfLoading' @change='onManualCountChange')
  button.pdf-clear-btn(v-if='pdfFileName' :disabled='pdfLoading' @click='onClearPdf') Отключить PDF режим

  .section-header
    h2.panel-title Параметры A4 (мм)
    button.presets-open-btn(type='button' :disabled='presetApplying' @click='onOpenPresetsModal') Пресеты
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

  .presets-modal-overlay(v-if='presetsModalOpen' @click.self='onClosePresetsModal')
    .presets-modal
      .presets-modal-header
        h3 Пресеты
        button.presets-close-btn(type='button' @click='onClosePresetsModal') ×

      p.presets-status(v-if='presetsLoading') Загрузка списка...
      p.presets-status.presets-status--error(v-else-if='presetsError') {{ presetsError }}
      p.presets-status(v-else-if='presets.length === 0') Список пресетов пуст.
      .presets-search-wrap(v-else)
        input.presets-search-input(
          v-model='presetSearch'
          type='search'
          placeholder='Поиск по названию или коду'
          autocomplete='off'
        )

      .presets-actions(v-if='presetsError || presets.length === 0')
        button.presets-reload-btn(type='button' :disabled='presetsLoading' @click='emit("reload-presets")') Обновить список

      p.presets-status(v-if='!presetsLoading && !presetsError && presets.length > 0 && filteredPresets.length === 0') Ничего не найдено.

      ul.presets-list(v-if='filteredPresets.length > 0')
        li.presets-item(v-for='preset in filteredPresets' :key='preset.file')
          button.presets-item-btn(type='button' :disabled='presetApplying' @click='onApplyPreset(preset.file)')
            span.presets-item-name {{ preset.name }}
            span.presets-item-meta {{ formatLabelsPerSheet(preset) }}
          a.presets-item-code-link(
            v-if='preset.code && preset.url'
            :href='preset.url'
            target='_blank'
            rel='noopener noreferrer'
            :title='`Открыть товар ${preset.code}`'
          ) {{ preset.code }}
          span.presets-item-code(v-else-if='preset.code') {{ preset.code }}
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

.pdf-meta {
  color: #1e3a8a;
  font-size: 0.72rem;
  font-weight: 700;
  margin: 0;
  word-break: break-word;
}

.pdf-loading {
  color: #1d4ed8;
  font-size: 0.72rem;
  font-weight: 700;
  margin: 0;
}

.pdf-clear-btn {
  background: #fff;
  border: 1px solid #bfdbfe;
  border-radius: 0.35rem;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.3rem 0.45rem;
}

.pdf-clear-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.section-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.presets-open-btn {
  background: #fff;
  border: 1px solid #bfdbfe;
  border-radius: 0.35rem;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.24rem 0.45rem;
}

.presets-open-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
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

.presets-modal-overlay {
  align-items: center;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 1rem;
  position: fixed;
  z-index: 1000;
}

.presets-modal {
  background: #fff;
  border-radius: 0.6rem;
  box-shadow: 0 18px 55px rgba(15, 23, 42, 0.28);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  max-width: 32rem;
  overflow: hidden;
  width: 100%;
}

.presets-modal-header {
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  padding: 0.7rem 0.85rem;
}

.presets-modal-header h3 {
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 800;
  margin: 0;
}

.presets-close-btn {
  background: transparent;
  border: 0;
  color: #64748b;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0;
}

.presets-status {
  color: #334155;
  font-size: 0.8rem;
  margin: 0;
  padding: 0.75rem 0.85rem;
}

.presets-status--error {
  color: #b91c1c;
  font-weight: 700;
}

.presets-actions {
  padding: 0 0.85rem 0.85rem;
}

.presets-search-wrap {
  padding: 0.65rem 0.85rem 0.2rem;
}

.presets-search-input {
  border: 1px solid #cbd5e1;
  border-radius: 0.38rem;
  color: #0f172a;
  font-size: 0.78rem;
  outline: 0;
  padding: 0.34rem 0.46rem;
  width: 100%;
}

.presets-search-input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.presets-reload-btn {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.35rem;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 700;
  padding: 0.28rem 0.55rem;
}

.presets-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  list-style: none;
  margin: 0;
  overflow: auto;
  padding: 0.6rem 0.7rem 0.8rem;
}

.presets-item {
  display: flex;
  flex-direction: row;
  gap: 0;
  margin: 0;
}

.presets-item-btn {
  align-items: flex-start;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.45rem 0 0 0.45rem;
  border-right: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 0.18rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  text-align: left;
  width: auto;
}

.presets-item-btn:hover {
  border-color: #93c5fd;
}

.presets-item-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.presets-item-name {
  color: #0f172a;
  font-size: 0.78rem;
  font-weight: 700;
}

.presets-item-meta {
  color: #64748b;
  font-size: 0.69rem;
  font-weight: 700;
}

.presets-item-code,
.presets-item-code-link {
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 0 0.45rem 0.45rem 0;
  display: inline-flex;
  font-size: 0.68rem;
  font-weight: 700;
  justify-content: center;
  line-height: 1.2;
  min-width: 5.8rem;
  padding: 0.16rem 0.45rem;
  white-space: nowrap;
}

.presets-item-code {
  background: #e2e8f0;
  color: #475569;
}

.presets-item-code-link {
  background: #dbeafe;
  border-color: #bfdbfe;
  color: #1d4ed8;
  text-decoration: none;
}

.presets-item-code-link:hover {
  background: #bfdbfe;
}

@media (max-width: 960px) {
  .left-sidebar {
    border-bottom: 1px solid #dbe2ea;
    border-right: 0;
    width: 100%;
  }
}
</style>
