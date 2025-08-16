import type { UserModule } from './types'

import { createApp } from 'vue'
import App from './App.vue'

import '@unocss/reset/tailwind.css'

import './styles/main.css'
import 'uno.css'
import 'vue-sonner/style.css'

const app = createApp(App)

Object.values(import.meta.glob<{ install: UserModule }>('./modules/*.ts', { eager: true }))
  .forEach(i => i.install?.(app))

app.mount('#app')
