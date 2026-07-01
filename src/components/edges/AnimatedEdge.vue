<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@vue-flow/core'
import { useFlowDesignerStore } from '../../stores/flowDesigner.js'
import { useEdgePath } from '../../composables/useEdgePath.js'
import { EDGE_LINE_STYLE_KEY, type EdgeLineStyle } from '../../types/edgeLineStyle.js'
import styles from './AnimatedEdge.module.scss'

const props = defineProps<EdgeProps>()

const designerStore = useFlowDesignerStore()
const injectedStyle = inject<Ref<EdgeLineStyle> | null>(EDGE_LINE_STYLE_KEY, null)

const lineStyle = computed<EdgeLineStyle>(() => {
  const fromData = props.data?.lineStyle as EdgeLineStyle | undefined
  if (fromData) return fromData
  if (injectedStyle) return injectedStyle.value
  return designerStore.edgeLineStyle
})

const { path } = useEdgePath(props, lineStyle)

/** 仅显式 animated: true 时流动（设计器默认静态，仿真/运行时再开） */
const isAnimated = computed(() => props.data?.animated === true)

const labelX = computed(() => path.value[1])
const labelY = computed(() => path.value[2])
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :interaction-width="interactionWidth ?? 20"
    :class="[isAnimated ? styles.edgeAnimated : styles.edgeStatic, selected && styles.edgeSelected]"
    :style="{ ...style, strokeWidth: selected ? 2.5 : 2 }"
  />
  <EdgeLabelRenderer v-if="label || data?.conditionExpression || data?.isDefault">
    <div
      :class="styles.label"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: 'all',
      }"
    >
      <span v-if="label" :class="styles.conditionText">{{ label }}</span>
      <span v-else-if="data?.isDefault" :class="styles.defaultTag">默认</span>
      <span v-else :class="styles.conditionText">{{ data?.conditionExpression }}</span>
    </div>
  </EdgeLabelRenderer>
</template>
