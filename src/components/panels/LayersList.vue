<script setup lang="ts">
import { computed } from 'vue'

import type { LabelElement } from '../../domain/types'

const props = defineProps<{
  elements: LabelElement[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (event: 'select', payload: string): void
  (event: 'delete', payload: string): void
  (event: 'move', payload: { id: string; direction: 'forward' | 'backward' }): void
}>()

const icons: Record<LabelElement['type'], string> = {
  text: '📝',
  code: '🔳',
  line: '➖',
  image: '🖼️',
}

const buildLabel = (element: LabelElement): string => {
  if (element.type === 'line') {
    return `Линия (${element.thickness}т)`
  }

  const base = element.dataSource === 'static'
    ? element.staticValue
    : element.dataSource === 'dynamic'
      ? `[Колонка ${element.csvColumn}]`
      : '[PDF]'

  return base.length > 15 ? `${base.slice(0, 15)}...` : base
}

const onDelete = (event: MouseEvent, id: string): void => {
  event.stopPropagation()
  emit('delete', id)
}

const onMove = (event: MouseEvent, id: string, direction: 'forward' | 'backward'): void => {
  event.stopPropagation()
  emit('move', { id, direction })
}

const layers = computed(() => {
  const total = props.elements.length
  return props.elements
    .map((element, index) => {
      return {
        element,
        canMoveUp: index < total - 1,
        canMoveDown: index > 0,
      }
    })
    .reverse()
})
</script>

<template lang="pug">
.layers
  .layer-item(
    v-for='layer in layers'
    :key='layer.element.id'
    :class='{ "layer-item--active": props.selectedId === layer.element.id }'
    @click='emit("select", layer.element.id)'
  )
    .layer-left
      span.icon {{ icons[layer.element.type] }}
      span.text {{ buildLabel(layer.element) }}
    .layer-actions
      button.move-btn(title='Выше' :disabled='!layer.canMoveUp' @click='onMove($event, layer.element.id, "forward")') ↑
      button.move-btn(title='Ниже' :disabled='!layer.canMoveDown' @click='onMove($event, layer.element.id, "backward")') ↓
      button.delete-btn(title='Удалить' @click='onDelete($event, layer.element.id)') ✕
</template>

<style scoped lang="scss">
.layers {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.layer-item {
  align-items: center;
  background: #fff;
  border: 1px solid #dbe2ea;
  border-radius: 0.35rem;
  cursor: pointer;
  display: flex;
  font-size: 0.75rem;
  justify-content: space-between;
  min-height: 2rem;
  padding: 0.35rem 0.45rem;
}

.layer-item:hover {
  background: #f8fafc;
}

.layer-item--active {
  background: #eff6ff;
  border-color: #60a5fa;
  font-weight: 700;
}

.layer-left {
  align-items: center;
  display: flex;
  gap: 0.4rem;
  min-width: 0;
}

.text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn {
  background: transparent;
  border: 0;
  color: #dc2626;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0 0.2rem;
}

.delete-btn:hover {
  color: #991b1b;
}

.layer-actions {
  align-items: center;
  display: flex;
  gap: 0.15rem;
}

.move-btn {
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 0.25rem;
  color: #334155;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
  min-width: 1.25rem;
  padding: 0.15rem 0.2rem;
}

.move-btn:hover:not(:disabled) {
  background: #eff6ff;
  border-color: #93c5fd;
}

.move-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
