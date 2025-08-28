<template>
    <div class="traffic-header">
        <div class="header-expand"></div>
        <div class="header-method">Method</div>
        <div class="header-url">URL</div>
        <div class="header-status">Status</div>
        <div class="header-time">Duration</div>
    </div>
</template>

<script setup lang="ts">
// Static header component that mirrors the TrafficEntry layout
</script>

<style scoped>
/* Use CSS custom properties for shared grid layout */
.traffic-header {
    display: grid;
    grid-template-columns: var(
        --traffic-grid-columns,
        40px 80px 1fr 80px 100px
    );
    gap: var(--traffic-grid-gap, var(--space-md));
    padding: var(--space-md) var(--space-sm) var(--space-md) 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border-bottom: 2px solid var(--surface-border);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-color-secondary);
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 2;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-expand {
    /* Empty column for expand controls - used for alignment with TrafficEntry */
    display: flex;
    align-items: center;
}

.header-method {
    text-align: center;
}

.header-url {
    padding-left: var(--space-xs);
}

.header-status {
    text-align: center;
}

.header-time {
    text-align: right;
    padding-right: var(--space-sm);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .traffic-header {
        grid-template-columns: 32px 60px 1fr 60px 80px;
        gap: var(--space-sm);
        font-size: var(--text-xs);
    }
}

@media (max-width: 480px) {
    .traffic-header {
        grid-template-columns: 24px 50px 1fr 50px;
        gap: var(--space-xs);
    }

    .header-time {
        display: none;
    }
}
</style>
