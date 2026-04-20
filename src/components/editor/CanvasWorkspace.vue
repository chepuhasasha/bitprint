<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { buildBarcodeSvgMarkup } from '../../domain/barcode'
import { PREVIEW_PX_PER_MM, mmToPx, roundMm } from '../../domain/constants'
import type { CodeElement, LabelElement, LineElement, TextElement } from '../../domain/types'
import { clamp, getElementBox } from '../../domain/utils'

interface MoveElementDrag {
  mode: 'move-element'
  id: string
  startClientX: number
  startClientY: number
  initial: Record<string, number>
}

interface ResizeDrag {
  mode: 'resize'
  id: string
  startClientX: number
  startClientY: number
  initialWidth: number
  initialHeight: number
}

interface LinePointDrag {
  mode: 'line-point'
  id: string
  point: 1 | 2
  startClientX: number
  startClientY: number
  initialX: number
  initialY: number
}

type DragState = MoveElementDrag | ResizeDrag | LinePointDrag

const props = defineProps<{
  labelWidthMm: number
  labelHeightMm: number
  elements: LabelElement[]
  csvData: string[][]
  selectedId: string | null
  getValue: (element: LabelElement, csvRow?: string[] | null) => string
}>()

const emit = defineEmits<{
  (event: 'select', id: string): void
  (event: 'patch-element', payload: { id: string; patch: Partial<LabelElement> }): void
}>()

const barcodeMarkup = ref<Record<string, string>>({})
const dragState = ref<DragState | null>(null)

const selectedElement = computed(() => {
  return props.elements.find((element) => element.id === props.selectedId) ?? null
})

const selectedBox = computed(() => {
  if (!selectedElement.value) {
    return null
  }

  return getElementBox(selectedElement.value)
})

const canvasWidthPx = computed(() => mmToPx(props.labelWidthMm, PREVIEW_PX_PER_MM))
const canvasHeightPx = computed(() => mmToPx(props.labelHeightMm, PREVIEW_PX_PER_MM))

const sizeLabel = computed(() => {
  return `Этикетка: ${props.labelWidthMm.toFixed(2)} × ${props.labelHeightMm.toFixed(2)} мм`
})

const mmToCanvasPx = (valueMm: number): number => {
  return Math.round(valueMm * PREVIEW_PX_PER_MM)
}

const pxToMm = (valuePx: number): number => {
  return roundMm(valuePx / PREVIEW_PX_PER_MM)
}

const labelStyle = computed(() => {
  return {
    width: `${canvasWidthPx.value}px`,
    height: `${canvasHeightPx.value}px`,
  }
})

const getNodeStyle = (element: LabelElement): Record<string, string> => {
  const box = getElementBox(element)
  return {
    left: `${mmToCanvasPx(box.left)}px`,
    top: `${mmToCanvasPx(box.top)}px`,
    width: `${Math.max(1, mmToCanvasPx(box.width))}px`,
    height: `${Math.max(1, mmToCanvasPx(box.height))}px`,
  }
}

const frameStyle = computed(() => {
  if (!selectedBox.value) {
    return {}
  }

  return {
    left: `${mmToCanvasPx(selectedBox.value.left)}px`,
    top: `${mmToCanvasPx(selectedBox.value.top)}px`,
    width: `${Math.max(1, mmToCanvasPx(selectedBox.value.width))}px`,
    height: `${Math.max(1, mmToCanvasPx(selectedBox.value.height))}px`,
  }
})

const resizeHandleStyle = computed(() => {
  if (!selectedElement.value || selectedElement.value.type === 'line') {
    return {}
  }

  return {
    left: `${mmToCanvasPx(selectedElement.value.x + selectedElement.value.width)}px`,
    top: `${mmToCanvasPx(selectedElement.value.y + selectedElement.value.height)}px`,
  }
})

const lineP1Style = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'line') {
    return {}
  }

  return {
    left: `${mmToCanvasPx(selectedElement.value.x1)}px`,
    top: `${mmToCanvasPx(selectedElement.value.y1)}px`,
  }
})

const lineP2Style = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'line') {
    return {}
  }

  return {
    left: `${mmToCanvasPx(selectedElement.value.x2)}px`,
    top: `${mmToCanvasPx(selectedElement.value.y2)}px`,
  }
})

const refreshBarcodeSources = (): void => {
  const next: Record<string, string> = {}

  for (let i = 0; i < props.elements.length; i += 1) {
    const element = props.elements[i]
    if (element.type !== 'code') {
      continue
    }

    const value = props.getValue(element)
    next[element.id] = buildBarcodeSvgMarkup(element, value) ?? ''
  }

  barcodeMarkup.value = next
}

watch(
  () => [props.elements, props.csvData],
  () => {
    refreshBarcodeSources()
  },
  { deep: true, immediate: true },
)

const getDisplayValue = (element: LabelElement): string => {
  return props.getValue(element)
}

const getTextStyle = (element: TextElement): Record<string, string> => {
  return {
    color: '#000',
    fontFamily: 'Arial, sans-serif',
    fontSize: `${Math.max(1, mmToCanvasPx(element.fontSize))}px`,
    fontWeight: element.bold ? '700' : '400',
    height: '100%',
    lineHeight: '1.15',
    overflow: 'hidden',
    textAlign: element.align,
    whiteSpace: 'pre-wrap',
    width: '100%',
    wordBreak: 'break-word',
  }
}

const getLineStyle = (element: LineElement): Record<string, string> => {
  const box = getElementBox(element)
  const dx = element.x2 - element.x1
  const dy = element.y2 - element.y1
  const lengthMm = Math.sqrt(dx * dx + dy * dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const thicknessPx = Math.max(1, mmToCanvasPx(element.thickness))
  const startX = mmToCanvasPx(element.x1 - box.left)
  const startY = mmToCanvasPx(element.y1 - box.top)

  return {
    background: '#000',
    height: `${thicknessPx}px`,
    left: `${startX}px`,
    position: 'absolute',
    top: `${Math.round(startY - thicknessPx / 2)}px`,
    transform: `rotate(${angle}deg)`,
    transformOrigin: '0 50%',
    width: `${Math.max(1, mmToCanvasPx(lengthMm))}px`,
  }
}

const getCodeStyle = (_element: CodeElement): Record<string, string> => {
  return {
    alignItems: 'center',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  }
}

const startDrag = (state: DragState, event: MouseEvent): void => {
  event.preventDefault()
  event.stopPropagation()

  dragState.value = state
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', stopDrag)
}

const stopDrag = (): void => {
  dragState.value = null
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', stopDrag)
}

const onMouseMove = (event: MouseEvent): void => {
  const current = dragState.value
  if (!current) {
    return
  }

  const dxMm = pxToMm(event.clientX - current.startClientX)
  const dyMm = pxToMm(event.clientY - current.startClientY)

  if (current.mode === 'move-element') {
    const element = props.elements.find((item) => item.id === current.id)
    if (!element) {
      return
    }

    if (element.type === 'line') {
      emit('patch-element', {
        id: element.id,
        patch: {
          x1: roundMm(current.initial.x1 + dxMm),
          y1: roundMm(current.initial.y1 + dyMm),
          x2: roundMm(current.initial.x2 + dxMm),
          y2: roundMm(current.initial.y2 + dyMm),
        } as Partial<LineElement>,
      })
      return
    }

    const nextX = clamp(roundMm(current.initial.x + dxMm), 0, Math.max(0, props.labelWidthMm - element.width))
    const nextY = clamp(roundMm(current.initial.y + dyMm), 0, Math.max(0, props.labelHeightMm - element.height))

    emit('patch-element', {
      id: element.id,
      patch: {
        x: nextX,
        y: nextY,
      } as Partial<LabelElement>,
    })

    return
  }

  if (current.mode === 'resize') {
    const nextWidth = Math.max(0.1, roundMm(current.initialWidth + dxMm))
    const nextHeight = Math.max(0.1, roundMm(current.initialHeight + dyMm))

    emit('patch-element', {
      id: current.id,
      patch: {
        width: nextWidth,
        height: nextHeight,
      } as Partial<LabelElement>,
    })

    return
  }

  emit('patch-element', {
    id: current.id,
    patch: (current.point === 1
      ? { x1: roundMm(current.initialX + dxMm), y1: roundMm(current.initialY + dyMm) }
      : { x2: roundMm(current.initialX + dxMm), y2: roundMm(current.initialY + dyMm) }) as Partial<LineElement>,
  })
}

const onElementMouseDown = (event: MouseEvent, element: LabelElement): void => {
  if (props.selectedId !== element.id) {
    emit('select', element.id)
  }

  if (element.type === 'line') {
    startDrag(
      {
        mode: 'move-element',
        id: element.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        initial: {
          x1: element.x1,
          y1: element.y1,
          x2: element.x2,
          y2: element.y2,
        },
      },
      event,
    )

    return
  }

  startDrag(
    {
      mode: 'move-element',
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initial: {
        x: element.x,
        y: element.y,
      },
    },
    event,
  )
}

const onResizeHandleMouseDown = (event: MouseEvent): void => {
  if (!selectedElement.value || selectedElement.value.type === 'line') {
    return
  }

  startDrag(
    {
      mode: 'resize',
      id: selectedElement.value.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initialWidth: selectedElement.value.width,
      initialHeight: selectedElement.value.height,
    },
    event,
  )
}

const onLinePointMouseDown = (event: MouseEvent, point: 1 | 2): void => {
  if (!selectedElement.value || selectedElement.value.type !== 'line') {
    return
  }

  startDrag(
    {
      mode: 'line-point',
      id: selectedElement.value.id,
      point,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initialX: point === 1 ? selectedElement.value.x1 : selectedElement.value.x2,
      initialY: point === 1 ? selectedElement.value.y1 : selectedElement.value.y2,
    },
    event,
  )
}
</script>

<template lang="pug">
section.workspace#editor-workspace
  #label-canvas(:style='labelStyle')
    .grid-background

    .content-layer
      .canvas-element(
        v-for='element in elements'
        :key='element.id'
        :class='{ "canvas-element--selected": selectedId === element.id }'
        :style='getNodeStyle(element)'
        @mousedown='onElementMouseDown($event, element)'
      )
        template(v-if='element.type === "text"')
          .text-render(:style='getTextStyle(element)') {{ getDisplayValue(element) }}

        template(v-else-if='element.type === "image"')
          img.element-image(:src='getDisplayValue(element)' alt='' draggable='false')

        template(v-else-if='element.type === "line"')
          .line-render(:style='getLineStyle(element)')

        template(v-else)
          .element-code(:style='getCodeStyle(element)' v-html='barcodeMarkup[element.id]')

    .control-layer
      .selection-frame(v-if='selectedElement' :style='frameStyle')

      .ctrl-handle.resize-handle(
        v-if='selectedElement && selectedElement.type !== "line"'
        :style='resizeHandleStyle'
        @mousedown='onResizeHandleMouseDown'
      )

      .ctrl-handle.line-handle(
        v-if='selectedElement && selectedElement.type === "line"'
        :style='lineP1Style'
        @mousedown='onLinePointMouseDown($event, 1)'
      )
      .ctrl-handle.line-handle(
        v-if='selectedElement && selectedElement.type === "line"'
        :style='lineP2Style'
        @mousedown='onLinePointMouseDown($event, 2)'
      )

  .canvas-size-indicator {{ sizeLabel }}
</template>

<style scoped lang="scss">
.workspace {
  align-items: center;
  background: #e2e8f0;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-height: 31.25rem;
  overflow: auto;
  padding: 2.5rem;
  position: relative;
}

#label-canvas {
  background: #fff;
  border: 1px solid #94a3b8;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 10%);
  box-sizing: content-box;
  overflow: visible;
  position: relative;
}

.grid-background {
  background-image:
    linear-gradient(to right, #e2e8f0 1px, transparent 1px),
    linear-gradient(to bottom, #e2e8f0 1px, transparent 1px);
  background-size: 14px 14px;
  inset: 0;
  opacity: 0.55;
  pointer-events: none;
  position: absolute;
  z-index: 0;
}

.content-layer {
  inset: 0;
  overflow: hidden;
  position: absolute;
}

.control-layer {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.canvas-element {
  cursor: move;
  position: absolute;
  user-select: none;
}

.canvas-element--selected {
  z-index: 10;
}

.text-render {
  display: block;
}

.element-image,
.element-code {
  display: block;
  height: 100%;
  width: 100%;
}

.element-code :deep(svg) {
  display: block;
  height: 100%;
  shape-rendering: crispEdges;
  width: 100%;
}

.line-render {
  pointer-events: none;
}

.selection-frame {
  box-sizing: border-box;
  outline: 1px solid rgb(0 100 255 / 80%);
  pointer-events: none;
  position: absolute;
  z-index: 15;
}

.ctrl-handle {
  background: #fff;
  border: 0.5px solid #0055ff;
  height: 6px;
  pointer-events: auto;
  position: absolute;
  transform: translate(-50%, -50%);
  width: 6px;
  z-index: 20;
}

.ctrl-handle:hover {
  background: #0055ff;
}

.resize-handle {
  cursor: nwse-resize;
}

.line-handle {
  cursor: crosshair;
}

.canvas-size-indicator {
  background: rgb(255 255 255 / 90%);
  border: 1px solid #dbe2ea;
  border-radius: 0.35rem;
  bottom: 1rem;
  box-shadow: 0 1px 2px rgb(15 23 42 / 10%);
  color: #64748b;
  font-family: 'Cascadia Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  left: 50%;
  padding: 0.35rem 0.65rem;
  position: absolute;
  transform: translateX(-50%);
}

@media (max-width: 960px) {
  .workspace {
    min-height: 22rem;
    padding: 1rem;
  }
}
</style>
