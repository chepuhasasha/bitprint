<script setup lang="ts">
import { ref, watch } from 'vue'

import { DEFAULT_DPI, dotsToMm, mmToDots } from '../../domain/constants'
import type { ElementType } from '../../domain/types'

const props = defineProps<{
  dpi: number
  width: number
  height: number
  printInProgress: boolean
  printLabel: string
}>()

const emit = defineEmits<{
  (event: 'update-dpi', payload: number): void
  (event: 'update-size', payload: { width: number; height: number }): void
  (event: 'add-element', payload: ElementType): void
  (event: 'save-project'): void
  (event: 'load-project', payload: File): void
  (event: 'print'): void
}>()

const widthDotsInput = ref(props.width)
const heightDotsInput = ref(props.height)
const widthMmInput = ref(Number(dotsToMm(props.width, props.dpi).toFixed(2)))
const heightMmInput = ref(Number(dotsToMm(props.height, props.dpi).toFixed(2)))
const dpiInput = ref(props.dpi)
const projectInputRef = ref<HTMLInputElement | null>(null)

const normalizePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizePositiveFloat = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const toRoundedMm = (dots: number, dpi: number): number => {
  return Number(dotsToMm(dots, dpi).toFixed(2))
}

watch(
  () => [props.width, props.height, props.dpi],
  ([nextWidth, nextHeight, nextDpi]) => {
    widthDotsInput.value = nextWidth
    heightDotsInput.value = nextHeight
    dpiInput.value = nextDpi
    widthMmInput.value = toRoundedMm(nextWidth, nextDpi)
    heightMmInput.value = toRoundedMm(nextHeight, nextDpi)
  },
  { immediate: true },
)

const applyDotsSize = (): void => {
  const nextWidth = Math.max(1, normalizePositiveInt(widthDotsInput.value, props.width))
  const nextHeight = Math.max(1, normalizePositiveInt(heightDotsInput.value, props.height))

  emit('update-size', {
    width: nextWidth,
    height: nextHeight,
  })
}

const applyMmSize = (): void => {
  const dpi = normalizePositiveInt(props.dpi, DEFAULT_DPI)
  const fallbackWidthMm = toRoundedMm(props.width, dpi)
  const fallbackHeightMm = toRoundedMm(props.height, dpi)
  const nextWidthMm = normalizePositiveFloat(widthMmInput.value, fallbackWidthMm)
  const nextHeightMm = normalizePositiveFloat(heightMmInput.value, fallbackHeightMm)

  emit('update-size', {
    width: Math.max(1, mmToDots(nextWidthMm, dpi)),
    height: Math.max(1, mmToDots(nextHeightMm, dpi)),
  })
}

const applyDpi = (): void => {
  const nextDpi = normalizePositiveInt(dpiInput.value, props.dpi)
  emit('update-dpi', nextDpi)
}

const triggerProjectInput = (): void => {
  projectInputRef.value?.click()
}

const onProjectPicked = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  emit('load-project', file)
  target.value = ''
}

const add = (type: ElementType): void => {
  emit('add-element', type)
}
</script>

<template lang="pug">
header.app-header
  .brand
    .brand__logo
      svg(xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round')
        rect(x='3' y='3' width='18' height='18' rx='2' ry='2')
        circle(cx='8.5' cy='8.5' r='1.5')
        polyline(points='21 15 16 10 5 21')
    h1.brand__title PixelPerfect Label Engine

  .toolbar
    .toolbar-group.toolbar-size-card
      span.group-label DPI
      label.inline-field
        span D
        input(v-model.number='dpiInput' type='number' min='1' max='2400' @change='applyDpi')

    .toolbar-group.toolbar-size-card
      span.group-label Размер (точки)
      label.inline-field
        span Ш
        input(v-model.number='widthDotsInput' type='number' min='1' max='10000' @change='applyDotsSize')
      label.inline-field
        span В
        input(v-model.number='heightDotsInput' type='number' min='1' max='10000' @change='applyDotsSize')

    .toolbar-group.toolbar-size-card
      span.group-label Размер (мм)
      label.inline-field
        span Ш
        input(v-model.number='widthMmInput' type='number' min='0.1' max='1000' step='0.1' @change='applyMmSize')
      label.inline-field
        span В
        input(v-model.number='heightMmInput' type='number' min='0.1' max='1000' step='0.1' @change='applyMmSize')

    .toolbar-group
      button.btn.btn--accent(@click='add("text")') + Текст
      button.btn(@click='add("code")') + Код
      button.btn(@click='add("image")') + Карт
      button.btn(@click='add("line")') + Линия

    .toolbar-group
      button.btn.btn--success(@click='emit("save-project")') Сохранить
      button.btn.btn--violet(@click='triggerProjectInput') Загрузить
      input(ref='projectInputRef' type='file' accept='.json' hidden @change='onProjectPicked')

  .print-area
    button.print-btn(:disabled='printInProgress' @click='emit("print")') {{ printLabel }}
</template>

<style scoped lang="scss">
.app-header {
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #dbe2ea;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding: 0.75rem 1rem;
}

.brand {
  align-items: center;
  display: flex;
  gap: 0.6rem;
}

.brand__logo {
  color: #1d4ed8;
}

.brand__title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}

.toolbar {
  align-items: center;
  display: flex;
  gap: 0.8rem;
  min-width: 0;
}

.toolbar-group {
  align-items: center;
  border-left: 1px solid #e2e8f0;
  display: flex;
  gap: 0.4rem;
  padding-left: 0.8rem;
}

.toolbar-group:first-child {
  border-left: 0;
  padding-left: 0;
}

.toolbar-size-card {
  background: #edf4ff;
  border: 1px solid #c5d8ff;
  border-radius: 0.4rem;
  padding: 0.35rem 0.5rem;
}

.group-label {
  color: #1e3a8a;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.inline-field {
  align-items: center;
  color: #1e3a8a;
  display: flex;
  font-size: 0.72rem;
  gap: 0.2rem;
}

.inline-field input {
  border: 1px solid #bcc8d8;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.2rem 0.35rem;
  text-align: center;
  width: 4.5rem;
}

.btn,
.print-btn {
  background: #f3f4f6;
  border: 1px solid #d0d7e2;
  border-radius: 0.35rem;
  color: #1f2937;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.35rem 0.55rem;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn:hover,
.print-btn:hover {
  background: #e8edf3;
}

.btn--accent {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #3730a3;
}

.btn--success {
  background: #ecfdf3;
  border-color: #b7ebcf;
  color: #166534;
}

.btn--violet {
  background: #f5f3ff;
  border-color: #d9d1fe;
  color: #5b21b6;
}

.print-btn {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #fff;
  font-weight: 700;
  padding: 0.5rem 0.9rem;
}

.print-btn:hover {
  background: #1e40af;
}

.print-btn:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (max-width: 1320px) {
  .app-header {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar {
    flex-wrap: wrap;
  }

  .print-area {
    align-self: flex-end;
  }
}
</style>
