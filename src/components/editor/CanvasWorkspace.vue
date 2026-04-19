<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { dotsToMm } from '../../domain/constants'
import { renderElement } from '../../domain/rasterizer'
import type { LabelElement, LineElement } from '../../domain/types'
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
  dpi: number
  width: number
  height: number
  elements: LabelElement[]
  csvData: string[][]
  selectedId: string | null
  getValue: (element: LabelElement, csvRow?: string[] | null) => string
}>()

const emit = defineEmits<{
  (event: 'select', id: string): void
  (event: 'patch-element', payload: { id: string; patch: Partial<LabelElement> }): void
}>()

const renderedSources = ref<Record<string, string>>({})
const dragState = ref<DragState | null>(null)
const workspaceRef = ref<HTMLElement | null>(null)
const workspaceViewport = ref({ width: 1, height: 1 })
const MIN_CANVAS_SCALE = 0.1
const FALLBACK_CANVAS_SCALE = 1
let renderTicket = 0
let workspaceResizeObserver: ResizeObserver | null = null

const selectedElement = computed(() => {
  return props.elements.find((element) => element.id === props.selectedId) ?? null
})

const selectedBox = computed(() => {
  if (!selectedElement.value) {
    return null
  }
  return getElementBox(selectedElement.value)
})

const sizeLabel = computed(() => {
  const mmW = dotsToMm(props.width, props.dpi).toFixed(1)
  const mmH = dotsToMm(props.height, props.dpi).toFixed(1)
  return `Матрица: ${props.width} × ${props.height} точек (≈ ${mmW} × ${mmH} мм)`
})

const parsePx = (value: string): number => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const updateWorkspaceViewport = (): void => {
  const workspace = workspaceRef.value
  if (!workspace) {
    return
  }

  const styles = window.getComputedStyle(workspace)
  const horizontalPadding = parsePx(styles.paddingLeft) + parsePx(styles.paddingRight)
  const verticalPadding = parsePx(styles.paddingTop) + parsePx(styles.paddingBottom)
  const indicatorReserve = 40

  workspaceViewport.value = {
    width: Math.max(1, workspace.clientWidth - horizontalPadding),
    height: Math.max(1, workspace.clientHeight - verticalPadding - indicatorReserve),
  }
}

const canvasScale = computed(() => {
  const fitByWidth = workspaceViewport.value.width / props.width
  const fitByHeight = workspaceViewport.value.height / props.height
  const fitScale = Math.min(fitByWidth, fitByHeight)

  if (!Number.isFinite(fitScale) || fitScale <= 0) {
    return FALLBACK_CANVAS_SCALE
  }

  return Math.max(MIN_CANVAS_SCALE, fitScale)
})

const labelStyle = computed(() => {
  return {
    width: `${props.width}px`,
    height: `${props.height}px`,
    transform: `scale(${canvasScale.value})`,
  }
})

const getNodeStyle = (element: LabelElement): Record<string, string> => {
  const box = getElementBox(element)
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  }
}

const frameStyle = computed(() => {
  if (!selectedBox.value) {
    return {}
  }

  return {
    left: `${selectedBox.value.left}px`,
    top: `${selectedBox.value.top}px`,
    width: `${selectedBox.value.width}px`,
    height: `${selectedBox.value.height}px`,
  }
})

const resizeHandleStyle = computed(() => {
  if (!selectedElement.value || selectedElement.value.type === 'line') {
    return {}
  }

  return {
    left: `${selectedElement.value.x + selectedElement.value.width}px`,
    top: `${selectedElement.value.y + selectedElement.value.height}px`,
  }
})

const lineP1Style = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'line') {
    return {}
  }

  return {
    left: `${selectedElement.value.x1}px`,
    top: `${selectedElement.value.y1}px`,
  }
})

const lineP2Style = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'line') {
    return {}
  }

  return {
    left: `${selectedElement.value.x2}px`,
    top: `${selectedElement.value.y2}px`,
  }
})

const refreshRenders = async (): Promise<void> => {
  const ticket = ++renderTicket
  const next: Record<string, string> = {}

  for (let index = 0; index < props.elements.length; index += 1) {
    const element = props.elements[index]
    const value = props.getValue(element)
    const canvas = await renderElement(element, value)

    if (ticket !== renderTicket) {
      return
    }

    if (canvas) {
      next[element.id] = canvas.toDataURL()
    }
  }

  renderedSources.value = next
}

watch(
  () => [props.elements, props.width, props.height, props.csvData],
  () => {
    void refreshRenders()
  },
  { deep: true, immediate: true },
)

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

onMounted(() => {
  updateWorkspaceViewport()
  if (workspaceRef.value) {
    workspaceResizeObserver = new ResizeObserver(() => {
      updateWorkspaceViewport()
    })
    workspaceResizeObserver.observe(workspaceRef.value)
  }
  window.addEventListener('resize', updateWorkspaceViewport)
})

onBeforeUnmount(() => {
  stopDrag()
  workspaceResizeObserver?.disconnect()
  workspaceResizeObserver = null
  window.removeEventListener('resize', updateWorkspaceViewport)
})

const onMouseMove = (event: MouseEvent): void => {
  const current = dragState.value
  if (!current) {
    return
  }

  const scale = canvasScale.value || FALLBACK_CANVAS_SCALE
  const dx = (event.clientX - current.startClientX) / scale
  const dy = (event.clientY - current.startClientY) / scale

  if (current.mode === 'move-element') {
    const element = props.elements.find((item) => item.id === current.id)
    if (!element) {
      return
    }

    if (element.type === 'line') {
      const deltaX = Math.round(current.initial.x1 + dx) - current.initial.x1
      const deltaY = Math.round(current.initial.y1 + dy) - current.initial.y1

      emit('patch-element', {
        id: element.id,
        patch: {
          x1: current.initial.x1 + deltaX,
          y1: current.initial.y1 + deltaY,
          x2: current.initial.x2 + deltaX,
          y2: current.initial.y2 + deltaY,
        } as Partial<LineElement>,
      })
      return
    }

    const nextX = clamp(Math.round(current.initial.x + dx), 0, Math.max(0, props.width - element.width))
    const nextY = clamp(Math.round(current.initial.y + dy), 0, Math.max(0, props.height - element.height))

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
    const nextWidth = Math.max(1, Math.round(current.initialWidth + dx))
    const nextHeight = Math.max(1, Math.round(current.initialHeight + dy))

    emit('patch-element', {
      id: current.id,
      patch: {
        width: nextWidth,
        height: nextHeight,
      } as Partial<LabelElement>,
    })

    return
  }

  const nextX = Math.round(current.initialX + dx)
  const nextY = Math.round(current.initialY + dy)

  emit('patch-element', {
    id: current.id,
    patch: (current.point === 1
      ? { x1: nextX, y1: nextY }
      : { x2: nextX, y2: nextY }) as Partial<LineElement>,
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
section.workspace#editor-workspace(ref='workspaceRef')
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
        img.element-render(:src='renderedSources[element.id]' alt='' draggable='false')

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
  image-rendering: pixelated;
  overflow: visible;
  position: relative;
  transform-origin: center center;
  transition: width 0.2s, height 0.2s, transform 0.2s;
}

.grid-background {
  background-image:
    linear-gradient(to right, #e2e8f0 1px, transparent 1px),
    linear-gradient(to bottom, #e2e8f0 1px, transparent 1px);
  background-size: 1px 1px;
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
  image-rendering: pixelated;
  position: absolute;
  user-select: none;
}

.canvas-element--selected {
  z-index: 10;
}

.element-render {
  display: block;
  height: 100%;
  pointer-events: none;
  width: 100%;
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
  height: 4px;
  pointer-events: auto;
  position: absolute;
  transform: translate(-50%, -50%);
  width: 4px;
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
