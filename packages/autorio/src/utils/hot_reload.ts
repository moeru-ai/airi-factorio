import type { EventId } from 'factorio:runtime'

// TODO: extract to a separate mod

export function create_hot_reloader(mod_name: string, before_reload: () => void) {
  if (!mods_globals) {
    mods_globals = {}
  }

  if (!mods_globals[mod_name]) {
    mods_globals[mod_name] = {
      remote_interfaces: [],
      event_listeners: {},
      add_remote_interface: (name: string, i: Record<string, (...args: any) => any>) => {
        mods_globals![mod_name].remote_interfaces.push(name)
        remote.add_interface(name, i)
        log(`add_remote_interface ${name}`)
      },
      add_event_listener: (event: EventId<any>, callback: (...args: any) => any) => {
        if (!mods_globals![mod_name].event_listeners[event]) {
          mods_globals![mod_name].event_listeners[event] = []
          script.on_event(event, () => {
            mods_globals![mod_name].event_listeners[event].forEach((callback) => {
              callback()
            })
          })
        }

        mods_globals![mod_name].event_listeners[event].push(callback)
      },
      before_reload: () => {
        log('before_reload')

        mods_globals![mod_name].remote_interfaces.forEach((name) => {
          remote.remove_interface(name)
        })

        for (const event in mods_globals![mod_name].event_listeners) {
          mods_globals![mod_name].event_listeners[event] = []
        }

        before_reload()
      },
      new_code_to_reload: '',
    }

    remote.add_interface(`${mod_name}_hot_reload`, {
      before_reload: () => {
        mods_globals![mod_name].before_reload()
      },
      append_code_to_reload: (code: string) => {
        mods_globals![mod_name].new_code_to_reload += code + string.char(10)
      },
      reload_code: () => {
        const [mod, err] = load(mods_globals![mod_name].new_code_to_reload, 'reload', 'bt', _G)
        if (!mod) {
          log(`[tstl-plugin-reload-factorio-mod] error reload mod: ${err}`)
          return
        }

        const [success, run_err] = pcall(mod)

        if (!success) {
          log(`[tstl-plugin-reload-factorio-mod] error run mod ${mod_name}: ${run_err}`)
          return
        }

        game.print(`[tstl-plugin-reload-factorio-mod] Mod reloaded: ${mod_name}`)
        log(`[tstl-plugin-reload-factorio-mod] Mod reloaded: ${mod_name}`)

        mods_globals![mod_name].new_code_to_reload = ''
      },
    })
  }

  return {
    add_remote_interface: mods_globals![mod_name].add_remote_interface,
    add_event_listener: mods_globals![mod_name].add_event_listener,
  }
}
