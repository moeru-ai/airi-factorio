import path from 'node:path'
import { cwd } from 'node:process'
import Vue from '@vitejs/plugin-vue'
import { LFS, SpaceCard } from 'hfup/vite'
import Unocss from 'unocss/vite'
import { defineConfig } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  resolve: {
    alias: {
      // eslint-disable-next-line ts/naming-convention
      '~/': `${path.resolve(__dirname, 'src')}/`,
    },
  },

  plugins: [
    Vue({
      include: [/\.vue$/],
      script: {
        defineModel: true,
      },
      features: {
        propsDestructure: true,
      },
    }),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss(),

    // https://github.com/webfansplz/vite-plugin-vue-devtools
    VueDevTools(),

    LFS(),
    SpaceCard({
      root: cwd(),
      title: 'Factorio YOLO v0 Playground',
      emoji: '🎮',
      colorFrom: 'yellow',
      colorTo: 'orange',
      sdk: 'static',
      pinned: false,
      license: 'mit',
      models: ['Ultralytics/YOLO11'], // TODO: replace with uploaded model
      // eslint-disable-next-line ts/naming-convention
      short_description: 'The playground for the Factorio YOLO v0 model.',
      thumbnail: 'https://raw.githubusercontent.com/moeru-ai/airi-factorio/refs/heads/main/models/factorio-yolo-v0/assets/thumbnail.jpeg',
    }),
  ],

  assetsInclude: ['**/*.onnx'],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },

  build: {
    sourcemap: true,
  },
})
