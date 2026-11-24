import { useEffect, useState } from 'react'
import {
  AirVent, Bell, Bot, Check, ChevronRight, CircleHelp, Cpu, Edit2, Fan, Home,
  Layers, Lightbulb, Mic, Moon, MoreVertical, Play, Plus, Power, Radio,
  Search, Settings, Shield, ShieldAlert, ShieldCheck, Sun, Thermometer,
  Trash2, Wifi, Zap, X, PlugZap, Activity as ActivityIcon, Sliders, Globe, RefreshCw,
  Volume2, VolumeX, Sparkles, UserCheck, Users
} from 'lucide-react'
import { api, wsUrl } from './api'
import type { Room, Device, Telemetry, Activity, AutomationRule, Scene, NodeStatus } from './types'

type Tab = 'home' | 'automation' | 'energy' | 'security' | 'settings'

const iconFor = (kind: string) =>
  kind === 'fan' ? Fan : kind === 'ac' ? AirVent : kind === 'socket' ? PlugZap : Lightbulb

const sceneIconFor = (icon: string) =>
  icon === 'Sun' ? Sun : icon === 'Power' ? Power : icon === 'Zap' ? Zap : icon === 'Bot' ? Bot : Moon

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('aiota-theme') as 'dark' | 'light') || 'dark')
  const [selectedRoomId, setSelectedRoomId] = useState<number>(1)

  const [rooms, setRooms] = useState<Room[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [telemetry, setTelemetry] = useState<Telemetry[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [nodes, setNodes] = useState<NodeStatus[]>([])
  const [error, setError] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  // Modals state
  const [showRoomConfig, setShowRoomConfig] = useState(false)
  const [showAddScene, setShowAddScene] = useState(false)
  const [editingScene, setEditingScene] = useState<Scene | null>(null)
  const [showAddRule, setShowAddRule] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)

  // Forms state
  const [roomName, setRoomName] = useState('')
  const [sceneName, setSceneName] = useState('')
  const [sceneDesc, setSceneDesc] = useState('')
  const [sceneIcon, setSceneIcon] = useState('Sun')
  const [sceneActions, setSceneActions] = useState<Record<number, { included: boolean; is_on: boolean }>>({})

  const [devName, setDevName] = useState('')
  const [devKind, setDevKind] = useState('light')
  const [devChannel, setDevChannel] = useState(1)
  const [devNodeId, setDevNodeId] = useState('aiota-living')
  const [devRoomId, setDevRoomId] = useState<number | null>(null)
  const [devIp, setDevIp] = useState('')

  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleSensor, setNewRuleSensor] = useState('temperature')
  const [newRuleOp, setNewRuleOp] = useState('>')
  const [newRuleThreshold, setNewRuleThreshold] = useState('28')
  const [newRuleDevice, setNewRuleDevice] = useState<number>(0)
  const [newRuleAction, setNewRuleAction] = useState('turn_on')

  // Settings Wi-Fi & Host state
  const [wifiSsid, setWifiSsid] = useState('Airtel_AIOTA.tech')
  const [wifiPassword, setWifiPassword] = useState('')
  const [wifiStatus, setWifiStatus] = useState('Connected (192.168.1.10)')
  const [apiHostInput, setApiHostInput] = useState(() => {
    const saved = localStorage.getItem('aiota-backend-url')
    if (saved) return saved
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')) {
      return 'https://analyst-hebrew-liverpool-deutsche.trycloudflare.com'
    }
    return typeof window !== 'undefined' ? window.location.origin : ''
  })
  const [pingLatency, setPingLatency] = useState<string | null>('2 ms')

  // ESP32 Hardware IP state
  const [esp32Ip, setEsp32Ip] = useState(() => {
    const saved = localStorage.getItem('aiota-esp32-ip')
    return saved && saved !== '192.168.1.100' && saved !== '192.168.1.32' ? saved : '192.168.1.11'
  })
  const [esp32Status, setEsp32Status] = useState<string | null>(null)
  const [isTestingEsp32, setIsTestingEsp32] = useState(false)

  // Joyful Sound & Sparkles State
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('aiota-muted') === 'true')
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; emoji: string }[]>([])

  // Temperature & Humidity Sensor Calibration Offsets
  const [tempOffset, setTempOffset] = useState<number>(() => {
    const s = localStorage.getItem('aiota-temp-offset')
    return s ? parseFloat(s) : -1.5
  })
  const [humOffset, setHumOffset] = useState<number>(() => {
    const s = localStorage.getItem('aiota-hum-offset')
    return s ? parseFloat(s) : 0
  })

  const [listening, setListening] = useState(false)
  const [isArmed, setIsArmed] = useState(true)

  async function refresh() {
    try {
      const [r, d, t, a, rul, scn, nds] = await Promise.all([
        api.rooms(),
        api.devices(),
        api.telemetry(),
        api.activities(),
        api.rules().catch(() => []),
        api.scenes().catch(() => []),
        api.nodes().catch(() => []),
      ])
      setRooms(r)
      setDevices(d)
      if (d.length > 0 && d[0].ip_address) {
        const boardIp = d[0].ip_address
        setEsp32Ip(boardIp)
        localStorage.setItem('aiota-esp32-ip', boardIp)
      }
      if (r.length > 0) {
        setSelectedRoomId((prev) => (r.some((room) => room.id === prev) ? prev : r[0].id))
      }
      setTelemetry(t)
      setActivities(a)
      setRules(rul)
      setScenes(scn)
      setNodes(nds)
      setError('')
      if (d.length && !newRuleDevice) setNewRuleDevice(d[0].id)
    } catch {
      console.warn('Backend sync paused, retrying...')
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 20000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    try {
      const ws = new WebSocket(wsUrl)
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'relay') {
            // Update ONLY the target relay state immediately; never disrupt other relays
            setDevices((prev) =>
              prev.map((dev) => (dev.id === data.device_id ? { ...dev, is_on: data.is_on } : dev))
            )
            return
          }
          if (data.type === 'telemetry') {
            // Update telemetry readings without touching device switches
            setTelemetry((prev) => [...prev.slice(-49), data as Telemetry])
            return
          }
          if (data.type === 'automation' || data.type === 'scene') {
            setToastMsg(data.message)
            setTimeout(() => setToastMsg(''), 4000)
            refresh()
            return
          }
        } catch {}
      }
      return () => ws.close()
    } catch {}
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('aiota-theme', theme)
  }, [theme])

  const activeRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0]
  const activeRoomNode = nodes.find((n) => n.room_name?.toLowerCase() === activeRoom?.name?.toLowerCase())

  // Prioritize physical ESP32 telemetry from active room or 'aiota-living'
  const livingTelemetry = telemetry.filter((t) => t.node_id === 'aiota-living')
  const latest = livingTelemetry.length > 0 ? livingTelemetry[livingTelemetry.length - 1] : telemetry[telemetry.length - 1]
  const isOccupied = activeRoomNode?.motion ?? Boolean(latest?.motion)

  // Calibrate & filter temperature and humidity against sensor saturation/board self-heating
  const rawTemp = activeRoomNode?.temperature ?? latest?.temperature
  const rawHum = activeRoomNode?.humidity ?? latest?.humidity
  const displayTemp = rawTemp != null
    ? Math.max(15, Math.min(50, Number((rawTemp + tempOffset).toFixed(1))))
    : 25.4
  const displayHum = rawHum != null
    ? Math.max(20, Math.min(95, Math.round(rawHum + humOffset)))
    : 52
  const activeCount = devices.filter((d) => d.is_on).length
  const onlineNodes = nodes.filter((n) => n.online).length

  // Live Power calculations
  const WATTAGE: Record<string, number> = { light: 15, fan: 65, ac: 1400, socket: 120 }
  const liveWatts = devices.reduce((sum, d) => (d.is_on ? sum + (WATTAGE[d.kind] || 30) : sum), 12)
  const todayKwh = latest?.energy_kwh ?? (liveWatts * 0.018)
  const estimatedCost = (todayKwh * 30 * 0.12).toFixed(2)
  const recentMotion = telemetry.slice(-4).some((t) => t.motion)

  const filteredDevices = devices.filter((d) => d.room_id === selectedRoomId)
  const activeInRoom = activeRoom && activeRoom.devices ? activeRoom.devices.filter((d) => d.is_on).length : 0

  const hr = new Date().getHours()
  const joyfulGreeting =
    hr < 12
      ? { title: 'Good morning! ☀️', sub: 'Hope your day starts bright and joyful' }
      : hr < 17
      ? { title: 'Good afternoon! 🌤️', sub: 'Everything running smoothly at home' }
      : hr < 21
      ? { title: 'Good evening! 🌆', sub: 'Time to unwind and relax in comfort' }
      : { title: 'Cozy night! 🌙', sub: 'Rest easy, AIOTA is keeping watch' }

  // Joyful Haptic Audio Feedback via Web Audio API (zero latency, no assets needed)
  function playHapticPop(isOn: boolean) {
    if (isMuted) return
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      const now = ctx.currentTime

      if (isOn) {
        // Bright cheerful rising bubble pop (C5 -> C6)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(520, now)
        osc.frequency.exponentialRampToValueAtTime(1040, now + 0.08)
        gain.gain.setValueAtTime(0.08, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
        osc.start(now)
        osc.stop(now + 0.08)
      } else {
        // Gentle soft release click
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(380, now)
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05)
        gain.gain.setValueAtTime(0.05, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
        osc.start(now)
        osc.stop(now + 0.05)
      }
    } catch {}
  }

  // Celebratory Floating Sparkles Burst
  function triggerSparkleBurst(e?: React.MouseEvent) {
    const emojis = ['✨', '🌟', '🎉', '⚡', '💫', '🪄']
    const x = e ? e.clientX : window.innerWidth / 2
    const y = e ? e.clientY : window.innerHeight / 3

    const newSparks = Array.from({ length: 6 }).map((_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() * 80 - 40),
      y: y + (Math.random() * 60 - 30),
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }))

    setSparkles((prev) => [...prev, ...newSparks])
    setTimeout(() => {
      setSparkles((prev) => prev.filter((s) => !newSparks.some((n) => n.id === s.id)))
    }, 1200)
  }

  function handleSelectTab(newTab: Tab, e: React.MouseEvent) {
    if (tab !== newTab) {
      playHapticPop(true)
      triggerSparkleBurst(e)
    }
    setTab(newTab)
  }

  // 1. Instant Optimistic Toggle (0ms visual latency) - Synced per room node
  async function toggle(d: Device, e?: React.MouseEvent) {
    const nextState = !d.is_on
    playHapticPop(nextState)
    if (nextState && Math.random() < 0.3) triggerSparkleBurst(e)
    const normName = d.name.trim().toLowerCase()

    // Find all appliances sharing the exact same channel OR name in this particular room node
    const matchingPeerIds = devices
      .filter((item) =>
        (item.channel === d.channel || item.name.trim().toLowerCase() === normName) &&
        item.room_id === d.room_id &&
        item.node_id === d.node_id
      )
      .map((item) => item.id)

    // Instant update across all matching channels in this particular room
    setDevices((prev) =>
      prev.map((item) =>
        matchingPeerIds.includes(item.id) ? { ...item, is_on: nextState } : item
      )
    )

    try {
      await api.toggle(d.id, nextState)
    } catch {
      // Revert if API fails
      setDevices((prev) =>
        prev.map((item) =>
          matchingPeerIds.includes(item.id) ? { ...item, is_on: d.is_on } : item
        )
      )
      setError('Relay command failed')
    }
  }

  // 2. Room Master Toggle (Instant update)
  async function handleToggleRoom(roomId: number, isOn: boolean, e?: React.MouseEvent) {
    playHapticPop(isOn)
    if (isOn) triggerSparkleBurst(e)
    setDevices((prev) =>
      prev.map((item) => (item.room_id === roomId ? { ...item, is_on: isOn } : item))
    )
    setToastMsg(`Switched all devices in room ${isOn ? 'ON ✨' : 'OFF'}`)
    setTimeout(() => setToastMsg(''), 2500)

    try {
      await api.toggleRoom(roomId, isOn)
    } catch {
      setError('Failed to switch all room devices')
      refresh()
    }
  }

  // 3. Scene Apply (Instant update)
  async function handleApplyScene(sceneId: number, e?: React.MouseEvent) {
    playHapticPop(true)
    triggerSparkleBurst(e)
    const scn = scenes.find((s) => s.id === sceneId)
    if (scn) {
      const actionMap = new Map(scn.actions.map((a) => [a.device_id, a.is_on]))
      setDevices((prev) =>
        prev.map((d) => (actionMap.has(d.id) ? { ...d, is_on: actionMap.get(d.id)! } : d))
      )
    }
    setToastMsg(`Scene activated ✨`)
    setTimeout(() => setToastMsg(''), 2500)

    try {
      await api.applyScene(sceneId)
    } catch {
      setError('Failed to trigger scene')
      refresh()
    }
  }

  async function handleDeleteScene(sceneId: number, name: string) {
    if (!confirm(`Delete scene "${name}"?`)) return
    try {
      await api.deleteScene(sceneId)
      await refresh()
    } catch {
      setError('Failed to delete scene')
    }
  }

  // Scene Configuration (Add / Edit / Add-Remove Rooms)
  function openSceneModal(sceneToEdit?: Scene) {
    const acts: Record<number, { included: boolean; is_on: boolean }> = {}
    if (sceneToEdit) {
      setEditingScene(sceneToEdit)
      setSceneName(sceneToEdit.name)
      setSceneDesc(sceneToEdit.description)
      setSceneIcon(sceneToEdit.icon)
      const actionMap = new Map(sceneToEdit.actions.map((a) => [a.device_id, a.is_on]))
      devices.forEach((d) => {
        acts[d.id] = {
          included: actionMap.has(d.id),
          is_on: actionMap.has(d.id) ? actionMap.get(d.id)! : true,
        }
      })
    } else {
      setEditingScene(null)
      setSceneName('')
      setSceneDesc('')
      setSceneIcon('Sun')
      devices.forEach((d) => {
        acts[d.id] = { included: false, is_on: true }
      })
    }
    setSceneActions(acts)
    setShowAddScene(true)
  }

  // Quick toggle all devices in a room for the scene
  function toggleRoomInScene(roomId: number, include: boolean) {
    const roomDevs = devices.filter((d) => d.room_id === roomId)
    setSceneActions((prev) => {
      const updated = { ...prev }
      roomDevs.forEach((d) => {
        updated[d.id] = { included: include, is_on: updated[d.id]?.is_on ?? true }
      })
      return updated
    })
  }

  async function handleSaveScene() {
    if (!sceneName.trim()) return
    const actions = Object.entries(sceneActions)
      .filter(([_, state]) => state.included)
      .map(([devId, state]) => ({ device_id: Number(devId), is_on: state.is_on }))

    if (!actions.length) {
      setError('Select at least one device or room for this scene')
      return
    }

    try {
      if (editingScene) {
        // Delete old and recreate with new config
        await api.deleteScene(editingScene.id)
      }
      await api.createScene({
        name: sceneName.trim(),
        description: sceneDesc.trim() || 'Custom scene',
        icon: sceneIcon,
        actions,
      })
      setShowAddScene(false)
      setToastMsg(`Saved scene "${sceneName}"`)
      setTimeout(() => setToastMsg(''), 2500)
      await refresh()
    } catch {
      setError('Failed to save scene')
    }
  }

  // Device Management
  function openAddDevice(roomId?: number) {
    setEditingDevice(null)
    setDevName('')
    setDevKind('light')
    setDevChannel(1)
    const targetRoomId = roomId || selectedRoomId || rooms[0]?.id || 1
    setDevRoomId(targetRoomId)
    setDevNodeId('aiota-living')
    setDevIp(devices.find(d => d.ip_address)?.ip_address || '192.168.1.32')
    setShowDeviceModal(true)
  }

  function openEditDevice(d: Device) {
    setEditingDevice(d)
    setDevName(d.name)
    setDevKind(d.kind)
    setDevChannel(d.channel)
    setDevRoomId(d.room_id ?? null)
    setDevNodeId(d.node_id)
    setDevIp(d.ip_address || '')
    setShowDeviceModal(true)
  }

  async function handleSaveDevice() {
    if (!devName.trim()) return
    try {
      const payload = {
        name: devName.trim(),
        kind: devKind,
        channel: Number(devChannel),
        node_id: devNodeId,
        room_id: devRoomId ? Number(devRoomId) : null,
        ip_address: devIp.trim() || null,
      }
      if (editingDevice) {
        await api.updateDevice(editingDevice.id, payload)
        setToastMsg(`Updated "${devName}"`)
      } else {
        await api.createDevice(payload)
        setToastMsg(`Added "${devName}"`)
      }
      setTimeout(() => setToastMsg(''), 2500)
      setShowDeviceModal(false)
      await refresh()
    } catch {
      setError('Failed to save device')
    }
  }

  async function handleDeleteDevice(deviceId: number, name: string) {
    if (!confirm(`Delete device "${name}"?`)) return
    try {
      await api.deleteDevice(deviceId)
      setShowDeviceModal(false)
      await refresh()
    } catch {
      setError('Failed to delete device')
    }
  }

  async function handleDeleteRoom(roomId: number, name: string) {
    if (!confirm(`Remove room "${name}"?`)) return
    try {
      await api.deleteRoom(roomId)
      if (selectedRoomId === roomId) {
        const remaining = rooms.filter((r) => r.id !== roomId)
        if (remaining.length) setSelectedRoomId(remaining[0].id)
      }
      setToastMsg(`Removed room "${name}"`)
      setTimeout(() => setToastMsg(''), 2500)
      await refresh()
    } catch {
      setError(`Failed to remove room "${name}"`)
    }
  }

  async function handleCreateRoom() {
    if (!roomName.trim()) return
    try {
      await api.createRoom(roomName.trim())
      setToastMsg(`Created room "${roomName.trim()}"`)
      setRoomName('')
      setTimeout(() => setToastMsg(''), 2500)
      await refresh()
    } catch {
      setError('Could not create room')
    }
  }

  async function handleToggleRule(ruleId: number) {
    try {
      await api.toggleRule(ruleId)
      await refresh()
    } catch {
      setError('Failed to toggle rule')
    }
  }

  async function handleDeleteRule(ruleId: number) {
    try {
      await api.deleteRule(ruleId)
      await refresh()
    } catch {
      setError('Failed to delete rule')
    }
  }

  async function handleCreateRule() {
    if (!newRuleName.trim() || !newRuleDevice) return
    try {
      await api.createRule({
        name: newRuleName.trim(),
        sensor: newRuleSensor,
        operator: newRuleOp,
        threshold_value: parseFloat(newRuleThreshold) || 0,
        target_device_id: newRuleDevice,
        action: newRuleAction,
        is_enabled: true,
      })
      setShowAddRule(false)
      setNewRuleName('')
      await refresh()
    } catch {
      setError('Failed to create rule')
    }
  }

  // Wi-Fi & Host settings functions
  async function testHostConnection() {
    const start = performance.now()
    const target = apiHostInput.trim().replace(/\/+$/, '')
    try {
      const res = await fetch(`${target}/api/health`)
      const elapsed = Math.round(performance.now() - start)
      if (res.ok) {
        setPingLatency(`${elapsed} ms · Operational`)
        localStorage.setItem('aiota-backend-url', target)
        setToastMsg(`Connected to backend (${elapsed} ms)`)
        await refresh()
      } else {
        setPingLatency('Error')
      }
    } catch {
      setPingLatency('Offline')
      setError(`Cannot reach ${target}`)
    }
  }

  async function handleApplyEsp32Ip() {
    if (!esp32Ip.trim()) return
    try {
      await api.setBoardIp(esp32Ip.trim())
      localStorage.setItem('aiota-esp32-ip', esp32Ip.trim())
      setToastMsg(`ESP32 hardware IP set to ${esp32Ip.trim()} across all relays`)
      setTimeout(() => setToastMsg(''), 3000)
      await refresh()
    } catch {
      setError('Failed to update ESP32 IP address')
    }
  }

  async function handleTestEsp32() {
    if (!esp32Ip.trim()) return
    setIsTestingEsp32(true)
    setEsp32Status(null)
    try {
      const res = await api.pingBoard(esp32Ip.trim())
      if (res.online) {
        setEsp32Status(`Connected: ${res.hardware || 'Waveshare ESP32-S3 6CH'}`)
        setToastMsg(`Waveshare ESP32-S3 reached at ${esp32Ip.trim()}`)
      } else {
        setEsp32Status(`Unreachable: ${res.error || 'Connection failed'}`)
        setError(`Could not reach ESP32 at ${esp32Ip.trim()}`)
      }
    } catch {
      setEsp32Status('Unreachable: Failed to connect')
      setError(`Cannot reach ESP32 at ${esp32Ip.trim()}`)
    } finally {
      setIsTestingEsp32(false)
    }
  }

  function handleConnectWifi() {
    setWifiStatus(`Connecting to ${wifiSsid}...`)
    setTimeout(() => {
      setWifiStatus(`Connected to ${wifiSsid} (IP: 192.168.1.10)`)
      setToastMsg(`Wi-Fi connected to ${wifiSsid}`)
    }, 1500)
  }

  function voice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError('Voice control not supported on this browser')
      return
    }
    const rec = new SR()
    rec.lang = 'en-US'
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onresult = (e: any) => {
      const said = e.results[0][0].transcript.toLowerCase()
      const d = devices.find((x) => said.includes(x.name.toLowerCase()))
      if (d) {
        toggle(d)
        setToastMsg(`Voice: toggled ${d.name}`)
      } else {
        setError(`Heard: "${said}". Try saying device name like "Light" or "Fan"`)
      }
    }
    rec.start()
  }

  return (
    <div className="mobile-app">
      {/* Top Header */}
      <header className="mobile-header">
        <div className="header-inner">
          <div className="mobile-top-bar">
            <div className="brand-badge">
              <div className="brand-icon">
                <Home size={19} />
              </div>
              <div className="brand-text">
                <b>AIOTA</b>
                <span>SMART HOME</span>
              </div>
            </div>
            <div className="top-icons">
              <button
                className="icon-pill-btn"
                title={isMuted ? 'Unmute joyful sounds' : 'Mute joyful sounds'}
                onClick={() => {
                  const next = !isMuted
                  setIsMuted(next)
                  localStorage.setItem('aiota-muted', String(next))
                  if (!next) playHapticPop(true)
                }}
              >
                {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <button className="icon-pill-btn" title="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button className="icon-pill-btn" title="Add device" onClick={() => openAddDevice()}>
                <Plus size={17} />
              </button>
            </div>
          </div>

          <div className="user-greeting">
            <div className="greeting-text">
              <h2>{joyfulGreeting.title}</h2>
              <p>{joyfulGreeting.sub} · {activeCount} of {devices.length} appliances active</p>
            </div>
            <div className="node-pulse-badge">
              <span className="node-pulse-dot" />
              <span>{onlineNodes || 3} Nodes Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area (Expands to Fullscreen on Laptop) */}
      <div className="app-content-wrapper">
        {/* Floating Sparkles Burst */}
        {sparkles.map((s) => (
          <span key={s.id} className="floating-sparkle-item" style={{ left: s.x, top: s.y }}>
            {s.emoji}
          </span>
        ))}
        {/* Alerts & Toasts */}
        {error && (
          <div className="mobile-alert error">
            <CircleHelp size={16} />
            <span>{error}</span>
            <button style={{ marginLeft: 'auto' }} onClick={() => setError('')}><X size={14} /></button>
          </div>
        )}

        {toastMsg && (
          <div className="mobile-alert info">
            <Zap size={16} />
            <span>{toastMsg}</span>
            <button style={{ marginLeft: 'auto' }} onClick={() => setToastMsg('')}><X size={14} /></button>
          </div>
        )}

        {/* 1. HOME TAB */}
        {tab === 'home' && (
          <>
            {/* Environment Strip (Temperature, Humidity, Air Quality, Power) */}
            <div className="env-strip">
              <div className="env-pill temp">
                <Thermometer size={18} />
                <div className="env-pill-info">
                  <small>Temp</small>
                  <b>{displayTemp}°C</b>
                </div>
              </div>
              <div className="env-pill hum">
                <ActivityIcon size={18} />
                <div className="env-pill-info">
                  <small>Humidity</small>
                  <b>{displayHum}%</b>
                </div>
              </div>
              <div className="env-pill air">
                <Radio size={18} />
                <div className="env-pill-info">
                  <small>Air Quality</small>
                  <b>{latest?.air_quality != null ? `${latest.air_quality.toFixed(0)} AQI` : '32 AQI'}</b>
                </div>
              </div>
              <div className="env-pill power">
                <Zap size={18} />
                <div className="env-pill-info">
                  <small>Power Draw</small>
                  <b>{liveWatts} W</b>
                </div>
              </div>
            </div>

            {/* Live PIR Motion Sensor Bar (Near Below Temperature) */}
            <div style={{ padding: '0 20px 12px' }}>
              <div className={`pir-motion-banner ${isOccupied ? 'occupied' : 'vacant'}`}>
                <div className="pir-banner-left">
                  <div className="pir-icon-box">
                    {isOccupied ? <Users size={18} /> : <UserCheck size={18} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="pir-banner-title">PIR SENSOR READING</span>
                      <span className={`pir-status-chip ${isOccupied ? 'chip-occupied' : 'chip-vacant'}`}>
                        <span className="pir-pulse-dot" />
                        {isOccupied ? 'Occupied' : 'Not Occupied'}
                      </span>
                    </div>
                    <span className="pir-banner-sub">
                      {isOccupied
                        ? 'Motion actively detected · Space is currently occupied'
                        : 'No motion detected · Space is clear (not occupied)'}
                    </span>
                  </div>
                </div>
                <div className="pir-banner-right">
                  <span className="pir-node-tag">ESP32-S3 · GPIO 4</span>
                </div>
              </div>
            </div>

            {/* Quick Scenes with Configure Button */}
            <div className="app-section">
              <div className="section-head-row">
                <h3>Quick Scenes</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="section-action-link" onClick={() => openSceneModal()}>
                    + New Scene
                  </button>
                </div>
              </div>
              <div className="scenes-scroll">
                {scenes.map((s) => {
                  const SIcon = sceneIconFor(s.icon)
                  return (
                    <div key={s.id} className="mobile-scene-card">
                      <div className="scene-card-top">
                        <div className="scene-icon-bubble">
                          <SIcon size={16} />
                        </div>
                        <button
                          className="icon-pill-btn"
                          style={{ width: 26, height: 26 }}
                          title="Configure scene rooms & actions"
                          onClick={() => openSceneModal(s)}
                        >
                          <Sliders size={12} />
                        </button>
                      </div>
                      <div onClick={() => handleApplyScene(s.id)} style={{ cursor: 'pointer' }}>
                        <b>{s.name}</b>
                        <span>{s.actions.length} channels configured</span>
                      </div>
                      <button
                        className="master-chip on"
                        style={{ marginTop: 8, width: '100%', padding: '5px 0' }}
                        onClick={() => handleApplyScene(s.id)}
                      >
                        ACTIVATE
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Room Filter Bar */}
            <div className="room-filter-bar">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  className={`room-pill ${selectedRoomId === r.id ? 'active' : ''}`}
                  onClick={() => setSelectedRoomId(r.id)}
                >
                  {r.name}
                </button>
              ))}
              <button
                className="room-pill configure-pill"
                onClick={() => setShowRoomConfig(true)}
                title="Configure rooms (Add / Delete)"
              >
                <Sliders size={13} style={{ marginRight: 6 }} />
                Configure Rooms
              </button>
            </div>

            {/* Room Master Switch */}
            {activeRoom && (
              <div style={{ padding: '0 20px 8px' }}>
                <div className="room-master-card">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0 }}>{activeRoom.name}</h4>
                      <span className="joyful-badge">
                        <Sparkles size={11} />
                        {activeInRoom > 0 ? `${activeInRoom} on · Glowing ✨` : 'Resting 💤'}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0' }}>{activeRoom.devices.length} channels configured</p>
                  </div>
                  <div className="master-switch-btns">
                    <button className="master-chip on" onClick={(e) => handleToggleRoom(activeRoom.id, true, e)}>
                      ALL ON
                    </button>
                    <button className="master-chip off" onClick={(e) => handleToggleRoom(activeRoom.id, false, e)}>
                      ALL OFF
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Native Responsive Device Grid (Fullscreen Laptop / 2-Col Mobile) */}
            <div className="app-section">
              <div className="section-head-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>Appliances ({filteredDevices.length})</h3>
                  <button
                    onClick={() => setTab('settings')}
                    style={{
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      color: 'var(--accent)',
                      borderRadius: 14,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                    title="Click to view or set physical ESP32 IP address in Settings"
                  >
                    <Cpu size={12} />
                    ESP32 IP: {devices[0]?.ip_address || 'Not Set'}
                  </button>
                </div>
                <button className="section-action-link" onClick={() => openAddDevice()}>
                  + Add Appliance
                </button>
              </div>

              <div className="device-grid-2col">
                {filteredDevices.map((d) => {
                  const Icon = iconFor(d.kind)
                  const isLighting = d.kind === 'light'
                  const isFan = d.kind === 'fan'
                  const isAc = d.kind === 'ac'

                  return (
                    <div
                      key={d.id}
                      className={`device-tile ${d.is_on ? 'is-on' : ''} ${isLighting ? 'kind-light' : isFan ? 'kind-fan' : isAc ? 'kind-ac' : 'kind-socket'}`}
                      onClick={(e) => toggle(d, e)}
                    >
                      <div className="tile-top">
                        <div className="tile-icon-bubble">
                          <Icon size={20} />
                        </div>
                        <button
                          className="icon-pill-btn"
                          style={{ width: 28, height: 28 }}
                          title="Edit appliance settings"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditDevice(d)
                          }}
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>

                      <div className="tile-details">
                        <b>{d.name}</b>
                        {(() => {
                          const sameChannelPeers = devices.filter(
                            (p) =>
                              p.channel === d.channel &&
                              p.room_id === d.room_id &&
                              p.node_id === d.node_id &&
                              p.id !== d.id
                          )
                          return (
                            <span>
                              CH{d.channel}
                              {sameChannelPeers.length > 0 ? ` · Synced with ${sameChannelPeers.map((p) => p.name).join(', ')}` : ''}
                              {' · '}{WATTAGE[d.kind] || 30}W
                            </span>
                          )
                        })()}
                      </div>

                      <div className="tile-footer">
                        <span className="status-label">{d.is_on ? 'ON' : 'OFF'}</span>
                        <div className={`mobile-toggle ${d.is_on ? 'on' : ''}`}>
                          <span />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* 2. AUTOMATION TAB */}
        {tab === 'automation' && (
          <div className="app-section">
            <div className="section-head-row">
              <h3>Automations & Scenes</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="section-action-link" onClick={() => openSceneModal()}>+ New Scene</button>
                <button className="section-action-link" onClick={() => setShowAddRule(true)}>+ New Rule</button>
              </div>
            </div>

            <h4 style={{ margin: '14px 0 8px', fontSize: 13, color: 'var(--muted)' }}>ONE-TOUCH SCENES</h4>
            <div style={{ display: 'grid', gap: 10 }}>
              {scenes.map((s) => {
                const SIcon = sceneIconFor(s.icon)
                return (
                  <div key={s.id} className="room-master-card" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="tile-icon-bubble" style={{ width: 36, height: 36, background: 'var(--panel-subtle)' }}>
                        <SIcon size={18} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 14 }}>{s.name}</h4>
                        <p>{s.description || `${s.actions.length} channels configured`}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button className="master-chip on" onClick={() => handleApplyScene(s.id)}>
                        RUN
                      </button>
                      <button
                        className="icon-pill-btn"
                        style={{ width: 30, height: 30 }}
                        title="Configure scene rooms"
                        onClick={() => openSceneModal(s)}
                      >
                        <Sliders size={13} />
                      </button>
                      <button
                        className="icon-pill-btn"
                        style={{ width: 30, height: 30 }}
                        title="Delete scene"
                        onClick={() => handleDeleteScene(s.id, s.name)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <h4 style={{ margin: '22px 0 8px', fontSize: 13, color: 'var(--muted)' }}>IF / THEN AUTOMATION RULES</h4>
            <div style={{ display: 'grid', gap: 10 }}>
              {rules.map((r) => (
                <div key={r.id} className="room-master-card" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="tile-icon-bubble" style={{ width: 36, height: 36 }}>
                      <Bot size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 14 }}>{r.name}</h4>
                      <p>IF {r.sensor} {r.operator} {r.threshold_value} &rarr; {r.action === 'turn_on' ? 'TURN ON' : 'TURN OFF'}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      className={`mobile-toggle ${r.is_enabled ? 'on' : ''}`}
                      onClick={() => handleToggleRule(r.id)}
                    >
                      <span />
                    </div>
                    <button
                      className="icon-pill-btn"
                      style={{ width: 30, height: 30 }}
                      onClick={() => handleDeleteRule(r.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. ENERGY TAB */}
        {tab === 'energy' && (
          <div className="app-section">
            <div className="section-head-row">
              <h3>Live Power & Energy Usage</h3>
            </div>

            <div className="room-master-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="tile-icon-bubble" style={{ background: 'var(--accent)', color: 'white', width: 48, height: 48 }}>
                  <Zap size={24} />
                </div>
                <div>
                  <small style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>Live House Draw</small>
                  <h2 style={{ margin: 0, fontSize: 26, fontFamily: 'Manrope' }}>{liveWatts} W</h2>
                </div>
              </div>

              <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Today's Energy</span>
                  <b style={{ display: 'block', fontSize: 16, fontFamily: 'Manrope' }}>{todayKwh.toFixed(2)} kWh</b>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Est. Monthly Cost</span>
                  <b style={{ display: 'block', fontSize: 16, fontFamily: 'Manrope' }}>${estimatedCost}</b>
                </div>
              </div>
            </div>

            <h4 style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--muted)' }}>CONSUMPTION BY APPLIANCE TYPE</h4>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { label: 'Air Conditioners', icon: AirVent, watts: 1400, count: devices.filter((d) => d.kind === 'ac' && d.is_on).length },
                { label: 'Ceiling & Exhaust Fans', icon: Fan, watts: 65, count: devices.filter((d) => d.kind === 'fan' && d.is_on).length },
                { label: 'LED Lighting', icon: Lightbulb, watts: 15, count: devices.filter((d) => d.kind === 'light' && d.is_on).length },
                { label: 'Wall Sockets', icon: PlugZap, watts: 120, count: devices.filter((d) => d.kind === 'socket' && d.is_on).length },
              ].map(({ label, icon: Icon, watts, count }) => (
                <div key={label} className="room-master-card" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon size={20} color="var(--accent-light)" />
                    <div>
                      <b style={{ fontSize: 13 }}>{label}</b>
                      <p>{count} running ({count * watts} W)</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: count > 0 ? 'var(--green)' : 'var(--muted)' }}>
                    {count > 0 ? `${count * watts} W` : '0 W'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. SECURITY TAB */}
        {tab === 'security' && (
          <div className="app-section">
            <div className="section-head-row">
              <h3>Home Perimeter & Motion</h3>
              <button
                className="master-chip"
                style={{ background: isArmed ? 'var(--green)' : 'var(--red)', color: 'white' }}
                onClick={() => setIsArmed(!isArmed)}
              >
                {isArmed ? 'ARMED' : 'DISARMED'}
              </button>
            </div>

            <div
              className="room-master-card"
              style={{
                borderColor: recentMotion ? 'var(--red)' : 'rgba(16,185,129,0.3)',
                background: recentMotion ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  className="tile-icon-bubble"
                  style={{
                    background: recentMotion ? 'var(--red)' : 'var(--green)',
                    color: 'white',
                    width: 48,
                    height: 48
                  }}
                >
                  {recentMotion ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
                </div>
                <div>
                  <h4 style={{ fontSize: 15 }}>
                    {recentMotion ? 'Motion Detected in Space' : 'Perimeter Secure'}
                  </h4>
                  <p>3 PIR motion sensors monitored across nodes</p>
                </div>
              </div>
            </div>

            <h4 style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--muted)' }}>SECURITY EVENT LOG</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {activities
                .filter((a) => a.category === 'security')
                .slice(0, 6)
                .map((a) => (
                  <div key={a.id} className="room-master-card" style={{ marginBottom: 0, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ShieldAlert size={16} color="#ef4444" />
                      <div>
                        <b style={{ fontSize: 12 }}>{a.message}</b>
                        <p>{new Date(a.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              {!activities.some((a) => a.category === 'security') && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                  All quiet. No security alert events detected.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. SETTINGS TAB (Wi-Fi Manager, Localhost, Nodes & Preferences) */}
        {tab === 'settings' && (
          <div className="app-section">
            <div className="section-head-row">
              <h3>System Settings & Network</h3>
            </div>

            {/* Wi-Fi Connection Manager */}
            <h4 style={{ margin: '14px 0 8px', fontSize: 13, color: 'var(--muted)' }}>WI-FI CONNECTION MANAGER</h4>
            <div className="room-master-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Wifi size={18} color="var(--accent-light)" />
                  <div>
                    <h4 style={{ fontSize: 13 }}>Current Network</h4>
                    <p style={{ color: 'var(--green)' }}>{wifiStatus}</p>
                  </div>
                </div>
                <span className="node-pulse-badge">
                  <span className="node-pulse-dot" /> LIVE
                </span>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <small style={{ color: 'var(--muted)', fontSize: 11, display: 'block', marginBottom: 6 }}>
                  Connect to Another Wi-Fi Network
                </small>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, marginBottom: 10 }}>
                  <input
                    className="sheet-input"
                    style={{ marginBottom: 0 }}
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="Wi-Fi SSID Name"
                  />
                  <input
                    className="sheet-input"
                    style={{ marginBottom: 0 }}
                    type="password"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    placeholder="Password"
                  />
                </div>
                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '10px 14px' }}
                  onClick={handleConnectWifi}
                >
                  <Wifi size={14} style={{ marginRight: 6 }} /> Connect to Network
                </button>
              </div>
            </div>

            {/* Localhost / Server Host Manager */}
            <h4 style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--muted)' }}>SERVER & LOCALHOST HOSTS</h4>
            <div className="room-master-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Globe size={18} color="var(--accent-light)" />
                  <div>
                    <h4 style={{ fontSize: 13 }}>Server Target Host</h4>
                    <p>Connect to local or remote AIOTA servers</p>
                  </div>
                </div>
                {pingLatency && (
                  <span className="node-pulse-badge" style={{ color: pingLatency.includes('ms') ? 'var(--green)' : 'var(--red)' }}>
                    {pingLatency}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="sheet-input"
                  style={{ marginBottom: 0, flex: 1 }}
                  value={apiHostInput}
                  onChange={(e) => setApiHostInput(e.target.value)}
                  placeholder="e.g. http://192.168.1.10:5173"
                />
                <button
                  className="btn-secondary"
                  style={{ padding: '0 14px', whiteSpace: 'nowrap' }}
                  onClick={testHostConnection}
                >
                  <RefreshCw size={14} style={{ marginRight: 6 }} /> Test Ping
                </button>
              </div>
            </div>

            {/* ESP32 Hardware Relays Board Configuration */}
            <h4 style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--muted)' }}>
              PHYSICAL HARDWARE (WAVESHARE ESP32-S3 6CH)
            </h4>
            <div className="room-master-card" style={{ display: 'block', padding: '16px 20px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15 }}>ESP32 Board IP Address</h4>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                    Target IP of your physical board to trigger the 6 relay channels
                  </p>
                </div>
                {esp32Status && (
                  <span
                    className="node-pulse-badge"
                    style={{
                      color: esp32Status.includes('Connected') ? 'var(--green)' : 'var(--red)',
                      borderColor: esp32Status.includes('Connected') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                    }}
                  >
                    {esp32Status}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="sheet-input"
                  style={{ marginBottom: 0, flex: '1 1 200px' }}
                  value={esp32Ip}
                  onChange={(e) => setEsp32Ip(e.target.value)}
                  placeholder="e.g. 192.168.1.11"
                />
                <button
                  className="btn-secondary"
                  style={{ padding: '0 14px', whiteSpace: 'nowrap' }}
                  onClick={handleTestEsp32}
                  disabled={isTestingEsp32}
                >
                  <RefreshCw size={14} style={{ marginRight: 6 }} />
                  {isTestingEsp32 ? 'Testing…' : 'Test Board'}
                </button>
                <button
                  className="btn-primary"
                  style={{ padding: '0 16px', whiteSpace: 'nowrap' }}
                  onClick={handleApplyEsp32Ip}
                >
                  Apply to All Relays
                </button>
              </div>

              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Active ESP32 on Wi-Fi: <strong style={{ color: 'var(--fg)' }}>{devices[0]?.ip_address || '192.168.1.11'}</strong>
                </span>
                {esp32Ip !== (devices[0]?.ip_address || '192.168.1.11') && (
                  <button
                    className="master-chip on"
                    style={{ fontSize: 10, padding: '3px 10px', height: 'auto', borderRadius: 8 }}
                    onClick={() => {
                      const ip = devices[0]?.ip_address || '192.168.1.11'
                      setEsp32Ip(ip)
                      localStorage.setItem('aiota-esp32-ip', ip)
                      setToastMsg(`Set to live board IP ${ip}`)
                    }}
                  >
                    Click to use {devices[0]?.ip_address || '192.168.1.11'}
                  </button>
                )}
              </div>
            </div>

            {/* Sensor Calibration & Accuracy Tuning */}
            <h4 style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--muted)' }}>SENSOR ACCURACY & CALIBRATION</h4>
            <div className="room-master-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
              <div>
                <h4 style={{ margin: 0 }}>Temperature & Humidity Calibration</h4>
                <p style={{ margin: '4px 0 0' }}>Fine-tune readings to compensate for ESP32 PCB heat or sensor variation</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <small style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
                      Temperature Offset
                    </small>
                    <b style={{ color: 'var(--orange)', fontSize: 12 }}>
                      {tempOffset > 0 ? `+${tempOffset}` : tempOffset}°C (Live: {displayTemp}°C)
                    </b>
                  </div>
                  <input
                    type="range"
                    min="-6.0"
                    max="6.0"
                    step="0.5"
                    value={tempOffset}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setTempOffset(v)
                      localStorage.setItem('aiota-temp-offset', String(v))
                    }}
                    style={{ width: '100%', accentColor: 'var(--orange)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                    <span>-6°C</span>
                    <span>Neutral (0°C)</span>
                    <span>+6°C</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <small style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
                      Humidity Offset
                    </small>
                    <b style={{ color: 'var(--cyan)', fontSize: 12 }}>
                      {humOffset > 0 ? `+${humOffset}` : humOffset}% (Live: {displayHum}%)
                    </b>
                  </div>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="1"
                    value={humOffset}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setHumOffset(v)
                      localStorage.setItem('aiota-hum-offset', String(v))
                    }}
                    style={{ width: '100%', accentColor: 'var(--cyan)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                    <span>-25%</span>
                    <span>Neutral (0%)</span>
                    <span>+25%</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '4px 14px' }}
                  onClick={() => {
                    setTempOffset(-1.5)
                    setHumOffset(0)
                    localStorage.setItem('aiota-temp-offset', '-1.5')
                    localStorage.setItem('aiota-hum-offset', '0')
                    setToastMsg('Reset sensor calibration to default (-1.5°C PCB offset)')
                  }}
                >
                  Reset to Default (-1.5°C)
                </button>
              </div>
            </div>

            {/* Voice Assistant */}
            <h4 style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--muted)' }}>VOICE CONTROL</h4>
            <div className="room-master-card">
              <div>
                <h4>Voice Assistant</h4>
                <p>Speak commands like "Turn on Fan" or "Turn off Lights"</p>
              </div>
              <button
                className="master-chip on"
                onClick={voice}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Mic size={14} />
                {listening ? 'Listening…' : 'Start Voice'}
              </button>
            </div>

            {/* Hardware Nodes */}
            <h4 style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--muted)' }}>ESP32-S3 NODES</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {(nodes.length
                ? nodes
                : rooms.map((r, i) => ({
                    node_id: `aiota-node-${r.id}`,
                    name: `ESP32 Node · ${r.name}`,
                    room_name: r.name,
                    online: true,
                    ip_address: esp32Ip || '192.168.1.32',
                    relay_count: r.devices.length,
                    active_relays: r.devices.filter((d) => d.is_on).length,
                    temperature: 24.8 + i * 0.4,
                    humidity: 52 + i * 2,
                    motion: false,
                    last_seen: null,
                  }))
              ).map((n) => (
                <div key={n.node_id} className="room-master-card" style={{ marginBottom: 0, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="tile-icon-bubble" style={{ width: 36, height: 36 }}>
                      <Cpu size={18} />
                    </div>
                    <div>
                      <b style={{ fontSize: 13 }}>{n.node_id}</b>
                      <p>{n.room_name} · {n.ip_address || 'DHCP'}</p>
                    </div>
                  </div>
                  <span className="node-pulse-badge">
                    <span className="node-pulse-dot" />
                    ONLINE
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24 }}>
              <button className="btn-secondary" style={{ width: '100%' }} onClick={() => openAddDevice()}>
                + Register New Appliance
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Joyful Bottom Navigation Dock */}
      <nav className="mobile-bottom-nav">
        <button
          className={`nav-tab-btn ${tab === 'home' ? 'active' : ''}`}
          onClick={(e) => handleSelectTab('home', e)}
        >
          <div className="nav-icon-wrapper">
            <Home size={20} />
          </div>
          <span>Home</span>
          {tab === 'home' && <span className="nav-active-pip" />}
        </button>
        <button
          className={`nav-tab-btn ${tab === 'automation' ? 'active' : ''}`}
          onClick={(e) => handleSelectTab('automation', e)}
        >
          <div className="nav-icon-wrapper">
            <Bot size={20} />
          </div>
          <span>Automate</span>
          {tab === 'automation' && <span className="nav-active-pip" />}
        </button>
        <button
          className={`nav-tab-btn ${tab === 'energy' ? 'active' : ''}`}
          onClick={(e) => handleSelectTab('energy', e)}
        >
          <div className="nav-icon-wrapper">
            <Zap size={20} />
          </div>
          <span>Energy</span>
          {tab === 'energy' && <span className="nav-active-pip" />}
        </button>
        <button
          className={`nav-tab-btn ${tab === 'security' ? 'active' : ''}`}
          onClick={(e) => handleSelectTab('security', e)}
        >
          <div className="nav-icon-wrapper">
            <Shield size={20} />
          </div>
          <span>Security</span>
          {tab === 'security' && <span className="nav-active-pip" />}
        </button>
        <button
          className={`nav-tab-btn ${tab === 'settings' ? 'active' : ''}`}
          onClick={(e) => handleSelectTab('settings', e)}
        >
          <div className="nav-icon-wrapper">
            <Settings size={20} />
          </div>
          <span>Settings</span>
          {tab === 'settings' && <span className="nav-active-pip" />}
        </button>
      </nav>

      {/* MODALS */}

      {/* 1. Configure Rooms Sheet (Add & Delete) */}
      {showRoomConfig && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowRoomConfig(false)}>
          <div className="bottom-sheet" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h3>Configure Rooms</h3>
              <button onClick={() => setShowRoomConfig(false)}><X size={18} /></button>
            </div>

            {/* Add Room Section */}
            <div style={{ marginBottom: 18 }}>
              <small style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                Add New Room
              </small>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="sheet-input"
                  style={{ marginBottom: 0, flex: 1 }}
                  autoFocus
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Room name (e.g. Master Bedroom, Hall)..."
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                />
                <button
                  className="btn-primary"
                  style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                  onClick={handleCreateRoom}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            {/* Existing Rooms Section */}
            <div>
              <small style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                Existing Rooms ({rooms.length})
              </small>

              {rooms.length === 0 ? (
                <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, background: 'var(--panel)', borderRadius: 12, border: '1px dashed var(--line)' }}>
                  No rooms created yet. Add a room above to group your appliances.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                  {rooms.map((r) => {
                    const devCount = devices.filter((d) => d.room_id === r.id).length
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'var(--panel)',
                          border: '1px solid var(--line)',
                          borderRadius: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                            {devCount} {devCount === 1 ? 'appliance' : 'appliances'} assigned
                          </div>
                        </div>

                        <button
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleDeleteRoom(r.id, r.name)}
                          title={`Delete ${r.name}`}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="sheet-actions" style={{ marginTop: 22 }}>
              <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setShowRoomConfig(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add / Edit Device Sheet */}
      {showDeviceModal && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowDeviceModal(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h3>{editingDevice ? 'Edit Appliance' : 'Add Appliance'}</h3>
              <button onClick={() => setShowDeviceModal(false)}><X size={18} /></button>
            </div>

            <input
              className="sheet-input"
              autoFocus
              value={devName}
              onChange={(e) => setDevName(e.target.value)}
              placeholder="Device Name (e.g. Bedside Light)"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: 10, display: 'block', marginBottom: 4 }}>Type</small>
                <select className="sheet-input" value={devKind} onChange={(e) => setDevKind(e.target.value)}>
                  <option value="light">Light</option>
                  <option value="fan">Fan</option>
                  <option value="ac">Air Conditioner</option>
                  <option value="socket">Socket</option>
                </select>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: 10, display: 'block', marginBottom: 4 }}>Relay Channel</small>
                <select className="sheet-input" value={devChannel} onChange={(e) => setDevChannel(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((ch) => (
                    <option key={ch} value={ch}>CH {ch}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: 10, display: 'block', marginBottom: 4 }}>Room</small>
                <select
                  className="sheet-input"
                  value={devRoomId ?? ''}
                  onChange={(e) => setDevRoomId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">None (Unassigned)</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: 10, display: 'block', marginBottom: 4 }}>Node</small>
                <select className="sheet-input" value={devNodeId} onChange={(e) => setDevNodeId(e.target.value)}>
                  <option value="aiota-living">aiota-living (ESP32-S3)</option>
                  <option value="aiota-node-2">aiota-node-2</option>
                  <option value="custom">custom</option>
                </select>
              </div>
            </div>

            <div className="sheet-actions">
              {editingDevice ? (
                <>
                  <button className="btn-secondary" style={{ color: 'var(--red)' }} onClick={() => handleDeleteDevice(editingDevice.id, editingDevice.name)}>
                    Delete
                  </button>
                  <button className="btn-primary" onClick={handleSaveDevice}>
                    Save Changes
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-secondary" onClick={() => setShowDeviceModal(false)}>Cancel</button>
                  <button className="btn-primary" onClick={handleSaveDevice}>Add Device</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Create / Configure Scene Sheet (With Add/Remove Rooms options) */}
      {showAddScene && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowAddScene(false)}>
          <div className="bottom-sheet" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h3>{editingScene ? `Configure Scene: ${editingScene.name}` : 'Create Custom Scene'}</h3>
              <button onClick={() => setShowAddScene(false)}><X size={18} /></button>
            </div>

            <input
              className="sheet-input"
              autoFocus
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              placeholder="Scene Name (e.g. Movie Night)"
            />

            <input
              className="sheet-input"
              value={sceneDesc}
              onChange={(e) => setSceneDesc(e.target.value)}
              placeholder="Description (optional)"
            />

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {['Sun', 'Moon', 'Power', 'Zap', 'Bot'].map((ic) => {
                const SIcon = sceneIconFor(ic)
                return (
                  <button
                    key={ic}
                    className="icon-pill-btn"
                    style={{
                      border: sceneIcon === ic ? '1px solid var(--accent)' : '1px solid var(--line)',
                      color: sceneIcon === ic ? 'var(--accent-light)' : 'var(--muted)'
                    }}
                    onClick={() => setSceneIcon(ic)}
                  >
                    <SIcon size={16} />
                  </button>
                )
              })}
            </div>

            {/* Quick Room Toggle Pills (Add / Remove entire Rooms) */}
            <small style={{ color: 'var(--muted)', fontSize: 11, display: 'block', marginBottom: 8 }}>
              ADD / REMOVE ROOMS IN THIS SCENE:
            </small>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {rooms.map((r) => {
                const roomDevs = devices.filter((d) => d.room_id === r.id)
                const isEntireRoomIncluded = roomDevs.length > 0 && roomDevs.every((d) => sceneActions[d.id]?.included)
                return (
                  <button
                    key={r.id}
                    className={`master-chip ${isEntireRoomIncluded ? 'on' : ''}`}
                    onClick={() => toggleRoomInScene(r.id, !isEntireRoomIncluded)}
                  >
                    {isEntireRoomIncluded ? `✓ ${r.name}` : `+ ${r.name}`}
                  </button>
                )
              })}
            </div>

            <small style={{ color: 'var(--muted)', fontSize: 11, display: 'block', marginBottom: 8 }}>
              INDIVIDUAL RELAY TARGET STATES:
            </small>

            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 8, marginBottom: 16 }}>
              {rooms.map((r) => {
                const roomDevs = devices.filter((d) => d.room_id === r.id)
                if (!roomDevs.length) return null
                return (
                  <div key={r.id} style={{ background: 'var(--panel-subtle)', borderRadius: 12, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-light)' }}>{r.name}</span>
                      <small style={{ color: 'var(--muted)' }}>{roomDevs.length} devices</small>
                    </div>

                    <div style={{ display: 'grid', gap: 6 }}>
                      {roomDevs.map((d) => {
                        const st = sceneActions[d.id] || { included: false, is_on: true }
                        return (
                          <div
                            key={d.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              background: 'var(--panel)',
                              borderRadius: 8,
                            }}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={st.included}
                                onChange={(e) =>
                                  setSceneActions((prev) => ({
                                    ...prev,
                                    [d.id]: { ...st, included: e.target.checked }
                                  }))
                                }
                              />
                              <span>{d.name} <small style={{ color: 'var(--muted)' }}>(CH{d.channel})</small></span>
                            </label>

                            {st.included && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <small style={{ fontSize: 10, fontWeight: 700, color: st.is_on ? 'var(--green)' : 'var(--muted)' }}>
                                  {st.is_on ? 'SET ON' : 'SET OFF'}
                                </small>
                                <div
                                  className={`mobile-toggle ${st.is_on ? 'on' : ''}`}
                                  onClick={() =>
                                    setSceneActions((prev) => ({
                                      ...prev,
                                      [d.id]: { ...st, is_on: !st.is_on }
                                    }))
                                  }
                                >
                                  <span />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="sheet-actions">
              <button className="btn-secondary" onClick={() => setShowAddScene(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveScene}>Save Scene</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Create Rule Sheet */}
      {showAddRule && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowAddRule(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h3>Create Automation Rule</h3>
              <button onClick={() => setShowAddRule(false)}><X size={18} /></button>
            </div>

            <input
              className="sheet-input"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              placeholder="Rule Name (e.g. Turn Fan ON when Hot)"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: 8, marginBottom: 12 }}>
              <select className="sheet-input" style={{ marginBottom: 0 }} value={newRuleSensor} onChange={(e) => setNewRuleSensor(e.target.value)}>
                <option value="temperature">Temp (°C)</option>
                <option value="humidity">Humidity (%)</option>
                <option value="air_quality">Air (AQI)</option>
                <option value="motion">Motion</option>
              </select>
              <select className="sheet-input" style={{ marginBottom: 0 }} value={newRuleOp} onChange={(e) => setNewRuleOp(e.target.value)}>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value="==">==</option>
              </select>
              <input
                className="sheet-input"
                style={{ marginBottom: 0 }}
                type="number"
                value={newRuleThreshold}
                onChange={(e) => setNewRuleThreshold(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8, marginBottom: 16 }}>
              <select className="sheet-input" style={{ marginBottom: 0 }} value={newRuleDevice} onChange={(e) => setNewRuleDevice(Number(e.target.value))}>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select className="sheet-input" style={{ marginBottom: 0 }} value={newRuleAction} onChange={(e) => setNewRuleAction(e.target.value)}>
                <option value="turn_on">Turn ON</option>
                <option value="turn_off">Turn OFF</option>
              </select>
            </div>

            <div className="sheet-actions">
              <button className="btn-secondary" onClick={() => setShowAddRule(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateRule}>Save Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
