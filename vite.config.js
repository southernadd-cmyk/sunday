import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({build:{rollupOptions:{input:{main:resolve('index.html'),five:resolve('five.html'),pitchlab:resolve('pitchlab.html')},output:{manualChunks(id){if(id.includes('/node_modules/three/'))return 'three';}}}}});
