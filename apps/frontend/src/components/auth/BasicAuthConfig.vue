<template>
    <div class="basic-auth-config">
        <AuthValueSourceInput
            v-model="config.username"
            label="Username *"
            placeholder="Enter username or configure source"
            :error="errors?.username"
            @update:model-value="updateConfig"
        />

        <AuthValueSourceInput
            v-model="config.password"
            label="Password *"
            placeholder="Enter password or configure source"
            :error="errors?.password"
            @update:model-value="updateConfig"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BasicAuthConfig } from '@arachne/database'
import type {
    BasicAuthConfigProps,
    BasicAuthConfigEmits,
} from '@/types/auth-components'
import { validateAuthValueSource } from '@/types/auth-components'
import AuthValueSourceInput from '../AuthValueSourceInput.vue'

// Props
const props = withDefaults(defineProps<BasicAuthConfigProps>(), {
    errors: () => ({}),
})

// Emits
const emit = defineEmits<BasicAuthConfigEmits>()

// Computed
const config = computed({
    get: () => props.modelValue,
    set: (value: BasicAuthConfig) => emit('update:modelValue', value),
})

// Methods
const updateConfig = () => {
    emit('update:modelValue', config.value)
}

// Validation
const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    const usernameError = validateAuthValueSource(
        config.value.username,
        'Username'
    )
    if (usernameError) {
        errors.username = usernameError
    }

    const passwordError = validateAuthValueSource(
        config.value.password,
        'Password'
    )
    if (passwordError) {
        errors.password = passwordError
    }

    return errors
}

// Expose validation method
defineExpose({
    validate,
})
</script>

<style scoped>
.basic-auth-config {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}
</style>
