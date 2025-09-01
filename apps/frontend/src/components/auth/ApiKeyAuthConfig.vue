<template>
    <div class="api-key-auth-config">
        <AuthValueSourceInput
            v-model="config.key"
            label="API Key *"
            placeholder="Enter API key or configure source"
            :error="errors?.key"
            @update:model-value="updateConfig"
        />

        <AuthPlacementInput
            v-model="config.placement"
            label="Key Placement *"
            :error="errors?.placement"
            @update:model-value="updateConfig"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiKeyAuthConfig } from '@arachne/database'
import type {
    ApiKeyAuthConfigProps,
    ApiKeyAuthConfigEmits,
} from '@/types/auth-components'
import {
    validateAuthValueSource,
    validateAuthPlacement,
} from '@/types/auth-components'
import AuthValueSourceInput from '../AuthValueSourceInput.vue'
import AuthPlacementInput from '../AuthPlacementInput.vue'

// Props
const props = withDefaults(defineProps<ApiKeyAuthConfigProps>(), {
    errors: () => ({}),
})

// Emits
const emit = defineEmits<ApiKeyAuthConfigEmits>()

// Computed
const config = computed({
    get: () => props.modelValue,
    set: (value: ApiKeyAuthConfig) => emit('update:modelValue', value),
})

// Methods
const updateConfig = () => {
    emit('update:modelValue', config.value)
}

// Validation
const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    const keyError = validateAuthValueSource(config.value.key, 'API Key')
    if (keyError) {
        errors.key = keyError
    }

    const placementError = validateAuthPlacement(
        config.value.placement,
        'Placement'
    )
    if (placementError) {
        errors.placement = placementError
    }

    return errors
}

// Expose validation method
defineExpose({
    validate,
})
</script>

<style scoped>
.api-key-auth-config {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}
</style>
