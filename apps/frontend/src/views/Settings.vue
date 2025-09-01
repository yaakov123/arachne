<template>
    <div class="settings-container">
        <div class="settings-header">
            <h1>Settings</h1>
            <p>
                Manage projects, proxy server, and certificate authority
                settings
            </p>
        </div>

        <div class="settings-content">
            <TabContainer :tabs="settingsTabs" default-tab="projects">
                <!-- Projects Tab -->
                <template #projects>
                    <ProjectsTab />
                </template>

                <!-- Appearance Tab -->
                <template #appearance>
                    <AppearanceTab />
                </template>

                <!-- Certificate Authority Tab -->
                <template #certificates>
                    <CertificatesTab />
                </template>

                <!-- Auth Profiles Tab -->
                <template #auth-profiles>
                    <AuthProfilesTab />
                </template>
            </TabContainer>
        </div>
    </div>
</template>

<script setup lang="ts">
import ProjectsTab from '@/components/ProjectsTab.vue'
import AppearanceTab from '@/components/AppearanceTab.vue'
import CertificatesTab from '@/components/CertificatesTab.vue'
import AuthProfilesTab from '@/components/AuthProfilesTab.vue'
import TabContainer, { type Tab } from '@/components/TabContainer.vue'

// Tab definitions
const settingsTabs: Tab[] = [
    {
        id: 'projects',
        label: 'Projects',
    },
    {
        id: 'appearance',
        label: 'Appearance',
    },
    {
        id: 'certificates',
        label: 'Certificates',
    },
    {
        id: 'auth-profiles',
        label: 'Auth Profiles',
    },
]
</script>

<style scoped>
.settings-container {
    width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.settings-header {
    margin-bottom: 3rem;
}

.settings-header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 0.5rem 0;
}

.settings-header p {
    font-size: 1.125rem;
    color: var(--text-color-secondary);
    margin: 0;
}

.settings-content {
    height: calc(100vh - 200px);
    min-height: 600px;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
}

.settings-content :deep(.tab-container) {
    height: 100%;
    width: 100%;
    background: transparent;
}

.settings-content :deep(.tab-header) {
    background: transparent;
}

.settings-content :deep(.tab-content) {
    padding: 0;
    height: calc(100% - 48px); /* Subtract tab header height */
    overflow-y: auto;
    overflow-x: hidden;
}

@media (max-width: 768px) {
    .settings-container {
        padding: 1rem;
    }

    .settings-content {
        height: calc(100vh - 150px);
        min-height: 500px;
    }

    .settings-content :deep(.tab-content) {
        height: calc(100% - 40px); /* Smaller tab header on mobile */
    }
}
</style>
