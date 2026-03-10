import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  appType: 'spa',
  server: {
    port: 5173,
    strictPort: true,
    historyApiFallback: true,
    // Não exibe overlay de erro durante edições — mantém a UI antiga visível
    // enquanto arquivos estão sendo escritos. Erros aparecem só no terminal.
    hmr: {
      overlay: false,
    },
    watch: {
      // Aguarda a escrita completa do arquivo antes de disparar HMR.
      // Evita compilações com arquivo em estado parcial.
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 10,
      },
    },
  },
})
