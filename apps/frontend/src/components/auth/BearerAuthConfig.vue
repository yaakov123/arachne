<template>
    <div class="bearer-auth-config">
        <AuthValueSourceInput
            v-model="config.token"
            label="Bearer Token *"
            placeholder="Enter token or configure source"
            :error="errors?.token"
            @update:model-value="updateConfig"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BearerAuthConfig } from '@arachne/database'
import type {
    BearerAuthConfigProps,
    BearerAuthConfigEmits,
} from '@/types/auth-components'
import { validateAuthValueSource } from '@/types/auth-components'
import AuthValueSourceInput from '../AuthValueSourceInput.vue'

// Props
const props = withDefaults(defineProps<BearerAuthConfigProps>(), {
    errors: () => ({}),
})

// Emits
const emit = defineEmits<BearerAuthConfigEmits>()

// Computed
const config = computed({
    get: () => props.modelValue,
    set: (value: BearerAuthConfig) => emit('update:modelValue', value),
})

// Methods
const updateConfig = () => {
    emit('update:modelValue', config.value)
}

// Validation
const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    const tokenError = validateAuthValueSource(config.value.token, 'Token')
    if (tokenError) {
        errors.token = tokenError
    }

    return errors
}

// Expose validation method
defineExpose({
    validate,
})
</script>

<style scoped>
.bearer-auth-config {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}
</style>
