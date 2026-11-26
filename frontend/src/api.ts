import type { Room, Device, Telemetry, Activity, AutomationRule, Scene, NodeStatus } from './types'

export const DEFAULT_REMOTE_BACKEND = 'https://remote-believes-guys-former.trycloudflare.com'

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    let saved = localStorage.getItem('aiota-backend-url')
    // Automatically migrate stale / expired trycloudflare tunnel URLs to active tunnel
    if (saved && saved.includes('trycloudflare.com') && saved !== DEFAULT_REMOTE_BACKEND) {
      localStorage.setItem('aiota-backend-url', DEFAULT_REMOTE_BACKEND)
      saved = DEFAULT_REMOTE_BACKEND
    }
    if (saved) return saved.trim().replace(/\/+$/, '')
    if (window.location.hostname.endsWith('vercel.app')) {
      return DEFAULT_REMOTE_BACKEND
    }
  }
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
}

export function getWsUrl(): string {
  if (typeof window !== 'undefined') {
    let saved = localStorage.getItem('aiota-backend-url')
    if (saved && saved.includes('trycloudflare.com') && saved !== DEFAULT_REMOTE_BACKEND) {
      localStorage.setItem('aiota-backend-url', DEFAULT_REMOTE_BACKEND)
      saved = DEFAULT_REMOTE_BACKEND
    }
    const remote = saved || (window.location.hostname.endsWith('vercel.app') ? DEFAULT_REMOTE_BACKEND : '')
    if (remote) {
      try {
        const u = new URL(remote)
        return `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}/ws`
      } catch { }
    }
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  }
  return import.meta.env.VITE_WS_URL || 'ws://localhost:5173/ws'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase()
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) throw new Error((await res.text()) || `Request failed: ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  // Rooms
  rooms: () => request<Room[]>('/api/rooms'),
  createRoom: (name: string) => request<Room>('/api/rooms', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteRoom: (id: number) => request<void>(`/api/rooms/${id}`, { method: 'DELETE' }),
  toggleRoom: (roomId: number, is_on: boolean) => request<Room>(`/api/rooms/${roomId}/toggle-all`, { method: 'POST', body: JSON.stringify({ is_on }) }),

  // Devices & Relays
  devices: () => request<Device[]>('/api/devices'),
  createDevice: (data: Partial<Device>) => request<Device>('/api/devices', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id: number, data: Partial<Device>) => request<Device>(`/api/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDevice: (id: number) => request<void>(`/api/devices/${id}`, { method: 'DELETE' }),
  toggle: (id: number, is_on: boolean) => request<Device>(`/api/devices/${id}/relay`, { method: 'PATCH', body: JSON.stringify({ is_on }) }),
  updateNetwork: (id: number, ip_address: string) => request<Device>(`/api/devices/${id}/network`, { method: 'PATCH', body: JSON.stringify({ ip_address }) }),
  setBoardIp: (ip_address: string, node_id?: string) => request<{ ok: boolean; ip_address: string }>('/api/devices/set-board-ip', { method: 'POST', body: JSON.stringify({ ip_address, node_id }) }),
  pingBoard: (ip_address: string) => request<{ online: boolean; hardware?: string; error?: string }>('/api/devices/ping-board', { method: 'POST', body: JSON.stringify({ ip_address }) }),

  // Telemetry & Activities
  telemetry: () => request<Telemetry[]>('/api/telemetry'),
  activities: () => request<Activity[]>('/api/activities'),

  // Automations & Rules
  rules: () => request<AutomationRule[]>('/api/automations/rules'),
  createRule: (data: Partial<AutomationRule>) => request<AutomationRule>('/api/automations/rules', { method: 'POST', body: JSON.stringify(data) }),
  toggleRule: (id: number) => request<AutomationRule>(`/api/automations/rules/${id}/toggle`, { method: 'PATCH' }),
  deleteRule: (id: number) => request<void>(`/api/automations/rules/${id}`, { method: 'DELETE' }),

  // Scenes
  scenes: () => request<Scene[]>('/api/automations/scenes'),
  createScene: (data: Partial<Scene>) => request<Scene>('/api/automations/scenes', { method: 'POST', body: JSON.stringify(data) }),
  applyScene: (id: number) => request<Scene>(`/api/automations/scenes/${id}/apply`, { method: 'POST' }),
  deleteScene: (id: number) => request<void>(`/api/automations/scenes/${id}`, { method: 'DELETE' }),

  // Hardware Nodes
  nodes: () => request<NodeStatus[]>('/api/nodes'),
}

export const wsUrl = getWsUrl()
