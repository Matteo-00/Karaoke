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
      lib: {
        entry: {
          preload: resolve('electron/preload.ts'),
          'youtube-preload': resolve('electron/youtube-preload.ts')
        },
        formats: ['cjs']
      },
      // I preload girano in sandbox: devono essere CommonJS
      rollupOptions: { output: { entryFileNames: '[name].cjs' } }
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
