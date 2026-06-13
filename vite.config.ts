import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    electron({
      main: {
        // Shortcut of `build.lib.entry`
        entry: 'electron/main.ts',
      },
      preload: {
        // Shortcut of `build.rolldownOptions.input` (`build.rollupOptions.input` on Vite < 8)
        input: 'electron/preload.ts',
      },
      // Optional: Use Node.js API in the Renderer process
      renderer: {},
    }),
  ],
})
