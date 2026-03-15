import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 使用相对路径，避免 GitHub Pages 子路径下资源 404
  base: '/canmpus-food-map/',
})
