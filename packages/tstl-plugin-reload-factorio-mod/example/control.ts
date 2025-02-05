import type { EventId } from 'factorio:runtime'

import { add } from './example-dependency'

if (!mods_globals) {
  mods_globals = {}
}

if (!mods_globals.example) {
  mods_globals.example = {
    remote_interfaces: [],
    event_listeners: {},
    add_remote_interface: (name: string, i: Record<string, (...args: any) => any>) => {
      mods_globals.example.remote_interfaces.push(name)
      remote.add_interface(name, i)
      log(`add_remote_interface${name}`)
    },
    add_event_listener: (event: EventId<any>, callback: (...args: any) => any) => {
      if (!mods_globals.example.event_listeners[event]) {
        mods_globals.example.event_listeners[event] = []
        script.on_event(event, () => {
          mods_globals.example.event_listeners[event].forEach((callback) => {
            callback()
          })
        })
      }

      mods_globals.example.event_listeners[event].push(callback)
    },
    before_reload: () => {
      log('before_reload')

      mods_globals.example.remote_interfaces.forEach((name) => {
        remote.remove_interface(name)
      })

      for (const event in mods_globals.example.event_listeners) {
        mods_globals.example.event_listeners[event] = []
      }
    },
    new_code_to_reload: '',
  }

  remote.add_interface('example_mod', {
    before_reload: () => {
      mods_globals.example.before_reload()
    },
    append_code_to_reload: (code: string) => {
      mods_globals.example.new_code_to_reload += code + string.char(10)
    },
    reload_code: () => {
      const [mod, err] = load(mods_globals.example.new_code_to_reload, 'reload', 'bt', _G)
      if (!mod) {
        log(`[tstl-plugin-reload-factorio-mod] error reload mod: ${err}`)
        return
      }

      const [success, run_err] = pcall(mod)

      if (!success) {
        log(`[tstl-plugin-reload-factorio-mod] error run mod: ${run_err}`)
        return
      }

      game.print('[tstl-plugin-reload-factorio-mod] Mod reloaded: example_mod')
      log('[tstl-plugin-reload-factorio-mod] Mod reloaded: example_mod')

      mods_globals.example.new_code_to_reload = ''
    },
  })
}

mods_globals.example.add_remote_interface('example_mod_test', {
  add: (a: number, b: number) => {
    log(`Result: ${add(a, b)}`)
  },
})

log('mod loaded')
