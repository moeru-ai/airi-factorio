import type { EventId } from 'factorio:runtime'

export interface ModsGlobals {
  remote_interfaces: string[]
  event_listeners: Record<string, ((...args: any) => any)[]>
  add_remote_interface: (name: string, i: Record<string, (...args: any) => any>) => void
  add_event_listener: (event: EventId<any>, callback: (...args: any) => any) => void
  before_reload: () => void
  new_code_to_reload: string
}

declare global {
  let mods_globals: Record<string, ModsGlobals> | undefined
}
