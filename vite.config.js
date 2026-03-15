import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 部署到 GitHub Pages 时，站点地址为 https://<用户名>.github.io/<仓库名>/
  // 若仓库名不是 canmpus-food-map，请改成你的仓库名，如 base: '/你的仓库名/'
  base: '/canmpus-food-map/',
})
