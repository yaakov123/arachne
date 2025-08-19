import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ArachneProxy',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.es.js' : 'index.cjs.js'),
    },
    ssr: true
  
  },

  
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
})
