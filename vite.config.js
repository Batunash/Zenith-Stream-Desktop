import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './', // Electron için şart (Dosya yollarını düzeltir)
  root: 'renderer', // <--- KRİTİK: index.html burada olduğu için root'u değiştiriyoruz
  build: {
    outDir: '../dist', // Çıktıyı ana dizindeki 'dist' klasörüne at (renderer/dist değil)
    emptyOutDir: true,
  }
})