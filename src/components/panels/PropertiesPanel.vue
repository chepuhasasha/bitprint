<script setup lang="ts">
import { CODE_TYPE_OPTIONS, TEXT_ALIGN_OPTIONS } from '../../domain/constants'
import type { LabelElement } from '../../domain/types'

const props = defineProps<{
  selectedElement: LabelElement | null
  csvHeaders: string[]
}>()

const emit = defineEmits<{
  (event: 'update-prop', key: string, value: string | number | boolean): void
  (event: 'load-image', file: File): void
}>()

const sourceOptions = [
  { value: 'static', label: 'Статичное' },
  { value: 'dynamic', label: 'Из CSV' },
] as const

const boldOptions = [
  { value: 'false', label: 'Нет' },
  { value: 'true', label: 'Да' },
] as const

const scaleOptions = [
  { value: 'integer', label: 'Точное' },
  { value: 'stretch', label: 'Растянуть' },
] as const

const getEventValue = (event: Event): string => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
  return target?.value ?? ''
}

const onImageChange = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  emit('load-image', file)
  target.value = ''
}

const update = (key: string, value: string | number | boolean): void => {
  emit('update-prop', key, value)
}

const onNumberUpdate = (key: string, event: Event): void => {
  update(key, Number(getEventValue(event)))
}

const onStringUpdate = (key: string, event: Event): void => {
  update(key, getEventValue(event))
}
</script>

<template lang="pug">
aside.properties
  .properties-header
    h2 Свойства (мм)

  .properties-body(v-if='selectedElement')
    .block(v-if='selectedElement.type === "line"')
      h3 Координаты линии (мм)
      .grid-two
        label.field
          span X1
          input(type='number' step='0.01' :value='selectedElement.x1' @change='onNumberUpdate("x1", $event)')
        label.field
          span Y1
          input(type='number' step='0.01' :value='selectedElement.y1' @change='onNumberUpdate("y1", $event)')
        label.field
          span X2
          input(type='number' step='0.01' :value='selectedElement.x2' @change='onNumberUpdate("x2", $event)')
        label.field
          span Y2
          input(type='number' step='0.01' :value='selectedElement.y2' @change='onNumberUpdate("y2", $event)')
      label.field
        span Толщина (мм)
        input(type='number' step='0.01' min='0.01' :value='selectedElement.thickness' @change='onNumberUpdate("thickness", $event)')

    .block(v-else-if='selectedElement.type === "image"')
      h3 Изображение
      input(type='file' accept='image/*' @change='onImageChange')

    .block(v-else)
      h3 Источник данных
      label.field
        span Режим
        select(:value='selectedElement.dataSource' @change='onStringUpdate("dataSource", $event)')
          option(v-for='option in sourceOptions' :key='option.value' :value='option.value') {{ option.label }}

      label.field(v-if='selectedElement.dataSource === "static"')
        span Значение
        textarea(
          :rows='selectedElement.type === "text" ? 2 : 1'
          :value='selectedElement.staticValue'
          @input='onStringUpdate("staticValue", $event)'
        )

      label.field(v-else)
        span Колонка CSV
        select(:value='selectedElement.csvColumn' @change='onStringUpdate("csvColumn", $event)')
          option(v-for='(header, index) in csvHeaders' :key='`${header}-${index}`' :value='String(index)') Колонка {{ index + 1 }} ({{ header.slice(0, 10) }})
          option(v-if='csvHeaders.length === 0' value='0') Колонка 1

    .block(v-if='selectedElement.type !== "line"')
      h3 Геометрия (мм)
      .grid-two
        label.field
          span X
          input(type='number' step='0.01' :value='selectedElement.x' @change='onNumberUpdate("x", $event)')
        label.field
          span Y
          input(type='number' step='0.01' :value='selectedElement.y' @change='onNumberUpdate("y", $event)')
        label.field
          span Ширина
          input(type='number' step='0.01' min='0.1' :value='selectedElement.width' @change='onNumberUpdate("width", $event)')
        label.field
          span Высота
          input(type='number' step='0.01' min='0.1' :value='selectedElement.height' @change='onNumberUpdate("height", $event)')

    .block(v-if='selectedElement.type === "text"')
      h3 Стиль текста
      .inline
        label.field
          span Размер (мм)
          input(type='number' min='0.1' step='0.01' :value='selectedElement.fontSize' @change='onNumberUpdate("fontSize", $event)')
        label.field
          span Жирный
          select(:value='String(selectedElement.bold)' @change='onStringUpdate("bold", $event)')
            option(v-for='option in boldOptions' :key='option.value' :value='option.value') {{ option.label }}

      label.field
        span Выравнивание
        select(:value='selectedElement.align' @change='onStringUpdate("align", $event)')
          option(v-for='option in TEXT_ALIGN_OPTIONS' :key='option.value' :value='option.value') {{ option.label }}

    .block(v-if='selectedElement.type === "code"')
      h3 Штрихкод
      label.field
        span Тип
        select(:value='selectedElement.codeType' @change='onStringUpdate("codeType", $event)')
          option(v-for='option in CODE_TYPE_OPTIONS' :key='option.value' :value='option.value') {{ option.label }}
      label.field
        span Масштаб
        select(:value='selectedElement.scaleMode' @change='onStringUpdate("scaleMode", $event)')
          option(v-for='option in scaleOptions' :key='option.value' :value='option.value') {{ option.label }}

  .placeholder(v-else)
    | Выберите элемент
</template>

<style scoped lang="scss">
.properties {
  background: #fff;
  border-left: 1px solid #dbe2ea;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 20rem;
}

.properties-header {
  background: #f8fafc;
  border-bottom: 1px solid #dbe2ea;
  padding: 0.9rem;
}

.properties-header h2 {
  color: #475569;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  margin: 0;
  text-transform: uppercase;
}

.properties-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  overflow: auto;
  padding: 0.9rem;
}

.block {
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-bottom: 0.85rem;
}

.block h3 {
  color: #334155;
  font-size: 0.78rem;
  font-weight: 800;
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field span {
  color: #64748b;
  font-size: 0.73rem;
}

.field input,
.field select,
.field textarea,
.block > input[type='file'] {
  border: 1px solid #cbd5e1;
  border-radius: 0.35rem;
  font-family: inherit;
  font-size: 0.8rem;
  padding: 0.35rem 0.45rem;
}

.field textarea {
  resize: vertical;
}

.grid-two {
  display: grid;
  gap: 0.45rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.inline {
  display: grid;
  gap: 0.45rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.placeholder {
  color: #6b7280;
  font-size: 0.9rem;
  padding: 2rem 1rem;
  text-align: center;
}

@media (max-width: 960px) {
  .properties {
    border-left: 0;
    border-top: 1px solid #dbe2ea;
    width: 100%;
  }
}
</style>
