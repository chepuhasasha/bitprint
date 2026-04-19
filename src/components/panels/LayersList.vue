<script setup lang="ts">
import type { LabelElement } from '../../domain/types'

const props = defineProps<{
  elements: LabelElement[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (event: 'select', payload: string): void
  (event: 'delete', payload: string): void
}>()

const icons: Record<LabelElement['type'], string> = {
  text: '📝',
  thermal_text: '🔠',
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
    : `[Колонка ${element.csvColumn}]`

  return base.length > 15 ? `${base.slice(0, 15)}...` : base
}

const onDelete = (event: MouseEvent, id: string): void => {
  event.stopPropagation()
  emit('delete', id)
}
</script>

<template lang="pug">
.layers
  .layer-item(
    v-for='element in [...props.elements].reverse()'
    :key='element.id'
    :class='{ "layer-item--active": props.selectedId === element.id }'
    @click='emit("select", element.id)'
  )
    .layer-left
      span.icon {{ icons[element.type] }}
      span.text {{ buildLabel(element) }}
    button.delete-btn(title='Удалить' @click='onDelete($event, element.id)') ✕
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
</style>
