import { create_hot_reloader } from './utils/hot_reload'

export const hot_reloader = create_hot_reloader('autorio', () => {
  print('before_reload')
})
