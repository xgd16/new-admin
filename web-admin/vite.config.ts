import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vite 8 + @vitejs/plugin-react@6：JSX / React Refresh 由 Oxc 处理；静态检查用 oxlint（见 .oxlintrc.json）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // 生产 JS 压缩走 oxc-minify（Vite 8 + Rolldown 内置，无需单独安装 oxc-minify 包）
    minify: 'oxc',
  },
})
