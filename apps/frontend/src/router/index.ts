import { createRouter, createWebHistory } from 'vue-router'
import Logger from '@/views/Logger.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [{ path: '/', name: 'logger', component: Logger }],
})

export default router
