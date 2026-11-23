import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: { entry: resolve('electron/main.ts'), formats: ['es'] },
      rollupOptions: { output: { entryFileNames: 'main.js' } }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: { entry: resolve('electron/preload.ts'), formats: ['cjs'] },
      // Il preload gira in sandbox: deve essere CommonJS
      rollupOptions: { output: { entryFileNames: 'preload.cjs' } }
    }
  },
  renderer: {
    root: '.',
    resolve: { alias: { '@': resolve('src') } },
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve('index.html') }
    }
  }
})
