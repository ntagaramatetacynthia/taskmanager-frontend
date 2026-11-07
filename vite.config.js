const { defineConfig, loadEnv } = require('vite')
const react = require('@vitejs/plugin-react')

module.exports = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // Vite 8 bundles with Rolldown, which does not accept the v5 object form of
          // manualChunks. Groups below express the same vendor split via codeSplitting.
          codeSplitting: {
            groups: [
              { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 40 },
              { name: 'ui', test: /node_modules[\\/](lucide-react|clsx|react-hot-toast)[\\/]/, priority: 30 },
              { name: 'forms', test: /node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/, priority: 30 },
              { name: 'charts', test: /node_modules[\\/](recharts|d3-[a-z]+|victory-vendor)[\\/]/, priority: 20 },
              { name: 'axios', test: /node_modules[\\/]axios[\\/]/, priority: 20 },
            ],
          },
        },
      },
    },
    server: {
      // Default to 5175 (or PORT from env) and allow falling back to the next free
      // port if busy so starting the dev server never crashes when a port is in use.
      port: Number(env.PORT) || 5175,
      strictPort: false,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'https://taskmanager-backend-1-9yaq.onrender.com',
          changeOrigin: true,
          secure: true,
        }
      }
    }
  }
})
