<template>
    <div 
        :class="[
            'resizer',
            `resizer--${direction}`,
            { 'resizer--resizing': isResizing }
        ]"
        @mousedown="startResize"
    >
        <div class="resizer__handle"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

export interface ResizerProps {
    direction?: 'horizontal' | 'vertical'
    firstElement?: HTMLElement
    secondElement?: HTMLElement
    minSize?: number
    initialFirstSize?: number
    initialSecondSize?: number
}

export interface ResizerEmits {
    (e: 'resize-start'): void
    (e: 'resize-end'): void
}

const props = withDefaults(defineProps<ResizerProps>(), {
    direction: 'vertical',
    minSize: 150,
    initialFirstSize: 400,
    initialSecondSize: 300
})

const emit = defineEmits<ResizerEmits>()

const isResizing = ref(false)

// Initialize element sizes
const initializeElements = () => {
    if (!props.firstElement || !props.secondElement) return
    
    const isVertical = props.direction === 'vertical'
    const sizeProperty = isVertical ? 'height' : 'width'
    
    props.firstElement.style[sizeProperty] = `${props.initialFirstSize}px`
    props.secondElement.style[sizeProperty] = `${props.initialSecondSize}px`
}

const startResize = (event: MouseEvent) => {
    if (!props.firstElement || !props.secondElement) return
    
    event.preventDefault()
    isResizing.value = true
    
    const isVertical = props.direction === 'vertical'
    const startPosition = isVertical ? event.clientY : event.clientX
    const sizeProperty = isVertical ? 'height' : 'width'
    
    // Get current sizes from the elements
    const firstRect = props.firstElement.getBoundingClientRect()
    const secondRect = props.secondElement.getBoundingClientRect()
    const startFirstSize = isVertical ? firstRect.height : firstRect.width
    const startSecondSize = isVertical ? secondRect.height : secondRect.width
    
    emit('resize-start')
    
    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.value || !props.firstElement || !props.secondElement) return
        
        const currentPosition = isVertical ? e.clientY : e.clientX
        const delta = currentPosition - startPosition
        
        const newFirstSize = startFirstSize + delta
        const newSecondSize = startSecondSize - delta
        
        // Apply minimum size constraints
        const totalSize = startFirstSize + startSecondSize
        const maxFirstSize = totalSize - props.minSize
        const maxSecondSize = totalSize - props.minSize
        
        if (newFirstSize >= props.minSize && newFirstSize <= maxFirstSize &&
            newSecondSize >= props.minSize && newSecondSize <= maxSecondSize) {
            props.firstElement.style[sizeProperty] = `${newFirstSize}px`
            props.secondElement.style[sizeProperty] = `${newSecondSize}px`
        }
    }
    
    const handleMouseUp = () => {
        isResizing.value = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        
        emit('resize-end')
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    // Set appropriate cursor based on direction
    const cursor = isVertical ? 'row-resize' : 'col-resize'
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'
}

// Watch for element changes and initialize
watch([() => props.firstElement, () => props.secondElement], () => {
    initializeElements()
}, { immediate: true })

onMounted(() => {
    initializeElements()
})
</script>

<style scoped>
.resizer {
    position: relative;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-border, #e5e7eb);
}

.resizer--vertical {
    height: 8px;
    cursor: row-resize;
    flex-direction: row;
}

.resizer--horizontal {
    width: 8px;
    cursor: col-resize;
    flex-direction: column;
}

.resizer:hover {
    background: var(--primary-color, #3b82f6);
}

.resizer--resizing {
    background: var(--primary-color, #3b82f6);
}

.resizer__handle {
    background: var(--text-color-muted, #6b7280);
    border-radius: 2px;
    transition: background-color 0.2s ease;
}

.resizer--vertical .resizer__handle {
    width: 40px;
    height: 3px;
}

.resizer--horizontal .resizer__handle {
    width: 3px;
    height: 40px;
}

.resizer:hover .resizer__handle,
.resizer--resizing .resizer__handle {
    background: white;
}
</style>
