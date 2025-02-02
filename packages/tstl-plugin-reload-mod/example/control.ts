import type { EventId } from 'factorio:runtime'

if (!script.mods_globals) {
  script.mods_globals = {}
}

if (!script.mods_globals.example) {
  script.mods_globals.example = {
    remote_interfaces: [],
    event_listeners: {},
    add_remote_interface: (name: string, i: Record<string, (...args: any) => any>) => {
      script.mods_globals.example.remote_interfaces.push(name)
      remote.add_interface(name, i)
    },
    add_event_listener: (event: EventId<any>, callback: (...args: any) => any) => {
      if (!script.mods_globals.example.event_listeners[event]) {
        script.mods_globals.example.event_listeners[event] = []
        script.on_event(event, () => {
          script.mods_globals.example.event_listeners[event].forEach((callback) => {
            callback()
          })
        })
      }

      script.mods_globals.example.event_listeners[event].push(callback)
    },
    before_reload: () => {
      script.mods_globals.example.remote_interfaces.forEach((name) => {
        remote.remove_interface(name)
      })

      for (const event in script.mods_globals.example.event_listeners) {
        script.mods_globals.example.event_listeners[event] = []
      }
    },
  }
}

script.mods_globals.example.add_remote_interface('example', {
  print: (text: string) => {
    print('from first', text)
  },
})
