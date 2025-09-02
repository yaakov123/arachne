import { createRouter, createWebHistory } from 'vue-router'
import Logger from '@/views/Logger.vue'
import Settings from '@/views/Settings.vue'
import RequestEditor from '@/views/RequestEditor.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        { path: '/', name: 'logger', component: Logger },
        {
            path: '/request-editor',
            name: 'request-editor',
            component: RequestEditor,
        },
        { path: '/settings', name: 'settings', component: Settings },
    ],
})

export default router
