<script setup lang="ts">
import LayersList from './LayersList.vue'
import type { LabelElement } from '../../domain/types'

defineProps<{
  elements: LabelElement[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (event: 'load-csv', payload: File): void
  (event: 'select-layer', payload: string): void
  (event: 'delete-layer', payload: string): void
}>()

const onCsvSelected = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  emit('load-csv', file)
  target.value = ''
}
</script>

<template lang="pug">
aside.left-sidebar
  h2.panel-title База данных (CSV)
  input.csv-input(type='file' accept='.csv,.txt' @change='onCsvSelected')

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
