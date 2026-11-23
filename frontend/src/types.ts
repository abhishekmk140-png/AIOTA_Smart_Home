export type Device = {
  id: number
  name: string
  kind: string
  channel: number
  node_id: string
  ip_address?: string | null
  is_on: boolean
  room_id?: number | null
}

export type Room = {
  id: number
  name: string
  devices: Device[]
}

export type Telemetry = {
  id: number
  node_id: string
  temperature: number | null
  humidity: number | null
  air_quality: number | null
  energy_kwh: number | null
  motion: boolean | null
  recorded_at: string
}

export type Activity = {
  id: number
  message: string
  category: string
  created_at: string
}

export type AutomationRule = {
  id: number
  name: string
  sensor: string
  operator: string
  threshold_value: number
  target_device_id: number
  action: string
  is_enabled: boolean
  last_triggered_at: string | null
  created_at: string
  target_device?: Device
}

export type Scene = {
  id: number
  name: string
  icon: string
  description: string
  actions: { device_id: number; is_on: boolean }[]
}

export type NodeStatus = {
  node_id: string
  name: string
  room_name: string
  online: boolean
  last_seen: string | null
  ip_address: string | null
  relay_count: number
  active_relays: number
  temperature: number | null
  humidity: number | null
  motion: boolean | null
}
