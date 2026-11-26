import React, { useEffect, useRef, useState, useMemo } from 'react'
import {
  Thermometer,
  Droplets,
  Wind,
  Layers,
  RotateCw,
  Play,
  Pause,
  Compass,
  Sparkles,
  Info
} from 'lucide-react'
import type { Telemetry } from './types'

interface Live3DEnvironmentGraphsProps {
  telemetry: Telemetry[]
  currentTemp: number
  currentHum: number
  currentAir: number
  tempOffset?: number
  humOffset?: number
}

type GraphMode = 'matrix' | 'temperature' | 'humidity' | 'air'

interface Point3D {
  x: number
  y: number
  z: number
}

interface ProjectedPoint {
  x: number
  y: number
  depth: number
  scale: number
}

export const Live3DEnvironmentGraphs: React.FC<Live3DEnvironmentGraphsProps> = ({
  telemetry,
  currentTemp,
  currentHum,
  currentAir,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [mode, setMode] = useState<GraphMode>('matrix')
  const [autoRotate, setAutoRotate] = useState<boolean>(true)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Camera angles (Euler angles in radians)
  const cameraRef = useRef<{
    yaw: number
    pitch: number
    zoom: number
    targetYaw: number
    targetPitch: number
    isDragging: boolean
    lastMouseX: number
    lastMouseY: number
  }>({
    yaw: -0.42,
    pitch: 0.44,
    zoom: 1.0,
    targetYaw: -0.42,
    targetPitch: 0.44,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
  })

  // Format historical series (20 smoothed time steps)
  const processedData = useMemo(() => {
    const count = 20
    const rawList = [...telemetry].slice(-count)

    // Build synthesized baseline if raw list is sparse
    const result = []
    const now = Date.now()

    for (let i = 0; i < count; i++) {
      const idxFromEnd = count - 1 - i
      const item = rawList[rawList.length - 1 - idxFromEnd]
      const timeOffset = (count - 1 - i) * 15 * 1000 // 15s intervals
      const time = item?.recorded_at ? new Date(item.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date(now - timeOffset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      // Smooth wave variation for historical points if item is missing
      const wave = Math.sin((i / count) * Math.PI * 2) * 0.4
      const t = item?.temperature != null ? item.temperature : currentTemp - (count - 1 - i) * 0.08 + wave
      const h = item?.humidity != null ? item.humidity : currentHum - (count - 1 - i) * 0.15 + wave * 1.5
      const a = item?.air_quality != null ? item.air_quality : currentAir + (count - 1 - i) * 0.3 + wave * 2.0

      result.push({
        time,
        temp: Number(t.toFixed(1)),
        hum: Math.round(h),
        air: Math.round(a),
      })
    }
    // Always pin the latest item to exact live props
    if (result.length > 0) {
      result[result.length - 1].temp = Number(currentTemp.toFixed(1))
      result[result.length - 1].hum = Math.round(currentHum)
      result[result.length - 1].air = Math.round(currentAir)
    }
    return result
  }, [telemetry, currentTemp, currentHum, currentAir])

  // 3D perspective projection helper
  function project(
    p: Point3D,
    yaw: number,
    pitch: number,
    w: number,
    h: number,
    zoom: number
  ): ProjectedPoint {
    // 1. Rotate around Y (yaw)
    const cosY = Math.cos(yaw)
    const sinY = Math.sin(yaw)
    const x1 = p.x * cosY + p.z * sinY
    const z1 = -p.x * sinY + p.z * cosY

    // 2. Rotate around X (pitch)
    const cosP = Math.cos(pitch)
    const sinP = Math.sin(pitch)
    const y2 = p.y * cosP - z1 * sinP
    const z2 = p.y * sinP + z1 * cosP

    // 3. Perspective projection
    const camDist = 360
    const fov = 400
    const totalZ = z2 + camDist
    const scale = (fov / Math.max(20, totalZ)) * zoom

    const screenX = w / 2 + x1 * scale
    const screenY = h / 2 - y2 * scale

    return { x: screenX, y: screenY, depth: totalZ, scale }
  }

  // Animation & Rendering loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number

    const render = () => {
      const cam = cameraRef.current
      if (autoRotate && !cam.isDragging) {
        cam.targetYaw += 0.003
        if (cam.targetYaw > Math.PI * 2) cam.targetYaw -= Math.PI * 2
      }

      // Smooth camera interpolation
      cam.yaw += (cam.targetYaw - cam.yaw) * 0.1
      cam.pitch += (cam.targetPitch - cam.pitch) * 0.1

      // Responsive size matching DPR
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      // Ambient background glow
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h) * 0.7)
      bgGrad.addColorStop(0, 'rgba(30, 41, 67, 0.45)')
      bgGrad.addColorStop(1, 'rgba(10, 15, 29, 0)')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      const yaw = cam.yaw
      const pitch = cam.pitch
      const zoom = cam.zoom

      // 3D Scene Bounds
      const sceneW = 240
      const sceneD = 130
      const steps = processedData.length

      // 1. Draw 3D Isometric Ground Grid
      ctx.lineWidth = 1
      const gridLines = 8
      for (let i = 0; i <= gridLines; i++) {
        const x = -sceneW / 2 + (sceneW / gridLines) * i
        const p1 = project({ x, y: -45, z: -sceneD / 2 }, yaw, pitch, w, h, zoom)
        const p2 = project({ x, y: -45, z: sceneD / 2 }, yaw, pitch, w, h, zoom)

        ctx.strokeStyle = i === 0 || i === gridLines ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.06)'
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }

      for (let j = 0; j <= 5; j++) {
        const z = -sceneD / 2 + (sceneD / 5) * j
        const p1 = project({ x: -sceneW / 2, y: -45, z }, yaw, pitch, w, h, zoom)
        const p2 = project({ x: sceneW / 2, y: -45, z }, yaw, pitch, w, h, zoom)

        ctx.strokeStyle = j === 0 || j === 5 ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.06)'
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }

      // Render Lanes Configuration
      interface LaneConfig {
        key: 'temp' | 'hum' | 'air'
        name: string
        unit: string
        color: string
        glow: string
        zPos: number
        minVal: number
        maxVal: number
      }

      const lanes: LaneConfig[] = []

      if (mode === 'matrix' || mode === 'air') {
        lanes.push({
          key: 'air',
          name: 'Air Quality',
          unit: 'AQI',
          color: '#10b981',
          glow: 'rgba(16, 185, 129, 0.35)',
          zPos: mode === 'matrix' ? -40 : 0,
          minVal: 0,
          maxVal: 150,
        })
      }
      if (mode === 'matrix' || mode === 'humidity') {
        lanes.push({
          key: 'hum',
          name: 'Humidity',
          unit: '%',
          color: '#00f2fe',
          glow: 'rgba(0, 242, 254, 0.35)',
          zPos: mode === 'matrix' ? 0 : 0,
          minVal: 15,
          maxVal: 95,
        })
      }
      if (mode === 'matrix' || mode === 'temperature') {
        lanes.push({
          key: 'temp',
          name: 'Temperature',
          unit: '°C',
          color: '#ff6b6b',
          glow: 'rgba(255, 107, 107, 0.35)',
          zPos: mode === 'matrix' ? 40 : 0,
          minVal: 15,
          maxVal: 45,
        })
      }

      // Depth sort lanes so far lanes render before closer lanes
      lanes.sort((a, b) => {
        const za = a.zPos * Math.cos(yaw)
        const zb = b.zPos * Math.cos(yaw)
        return za - zb
      })

      // 2. Render each 3D Ribbon / Volumetric terrain
      lanes.forEach((lane) => {
        const topPts: ProjectedPoint[] = []
        const basePts: ProjectedPoint[] = []
        const ribbonWidth = mode === 'matrix' ? 16 : 38

        for (let i = 0; i < steps; i++) {
          const item = processedData[i]
          const val = item[lane.key]
          const norm = Math.max(0, Math.min(1, (val - lane.minVal) / (lane.maxVal - lane.minVal)))
          const y = -45 + norm * 80 // Height in 3D
          const x = -sceneW / 2 + (sceneW / (steps - 1)) * i

          const ptTop = project({ x, y, z: lane.zPos }, yaw, pitch, w, h, zoom)
          const ptBase = project({ x, y: -45, z: lane.zPos }, yaw, pitch, w, h, zoom)

          topPts.push(ptTop)
          basePts.push(ptBase)
        }

        // Extruded 3D curtain drop to ground
        ctx.beginPath()
        ctx.moveTo(topPts[0].x, topPts[0].y)
        for (let i = 1; i < topPts.length; i++) {
          ctx.lineTo(topPts[i].x, topPts[i].y)
        }
        for (let i = basePts.length - 1; i >= 0; i--) {
          ctx.lineTo(basePts[i].x, basePts[i].y)
        }
        ctx.closePath()

        const curtainGrad = ctx.createLinearGradient(0, topPts[topPts.length - 1].y, 0, basePts[0].y)
        curtainGrad.addColorStop(0, lane.glow)
        curtainGrad.addColorStop(1, 'rgba(10, 15, 30, 0.05)')
        ctx.fillStyle = curtainGrad
        ctx.fill()

        // 3D Ribbon Depth Band (Back edge)
        const backTopPts: ProjectedPoint[] = []
        for (let i = 0; i < steps; i++) {
          const item = processedData[i]
          const val = item[lane.key]
          const norm = Math.max(0, Math.min(1, (val - lane.minVal) / (lane.maxVal - lane.minVal)))
          const y = -45 + norm * 80
          const x = -sceneW / 2 + (sceneW / (steps - 1)) * i
          backTopPts.push(project({ x, y, z: lane.zPos - ribbonWidth }, yaw, pitch, w, h, zoom))
        }

        // Top 3D Polygon Surface
        for (let i = 0; i < steps - 1; i++) {
          ctx.beginPath()
          ctx.moveTo(topPts[i].x, topPts[i].y)
          ctx.lineTo(topPts[i + 1].x, topPts[i + 1].y)
          ctx.lineTo(backTopPts[i + 1].x, backTopPts[i + 1].y)
          ctx.lineTo(backTopPts[i].x, backTopPts[i].y)
          ctx.closePath()

          ctx.fillStyle = i % 2 === 0 ? lane.glow : 'rgba(255, 255, 255, 0.12)'
          ctx.fill()
        }

        // Top Neon Spine Line
        ctx.beginPath()
        ctx.moveTo(topPts[0].x, topPts[0].y)
        for (let i = 1; i < topPts.length; i++) {
          ctx.lineTo(topPts[i].x, topPts[i].y)
        }
        ctx.strokeStyle = lane.color
        ctx.lineWidth = 2.5
        ctx.shadowColor = lane.color
        ctx.shadowBlur = 10
        ctx.stroke()
        ctx.shadowBlur = 0

        // Vertical luminous light pins & data vertices
        for (let i = 0; i < steps; i++) {
          const p = topPts[i]
          const isLatest = i === steps - 1
          const isHovered = hoverIndex === i

          // Node Sphere
          ctx.beginPath()
          ctx.arc(p.x, p.y, isLatest ? 5.5 : isHovered ? 4.5 : 2.5, 0, Math.PI * 2)
          ctx.fillStyle = isLatest || isHovered ? '#ffffff' : lane.color
          ctx.fill()

          if (isLatest) {
            // Pulsing live ring
            const pulse = (Date.now() % 1500) / 1500
            ctx.beginPath()
            ctx.arc(p.x, p.y, 5 + pulse * 12, 0, Math.PI * 2)
            ctx.strokeStyle = lane.color
            ctx.lineWidth = 1.5 * (1 - pulse)
            ctx.stroke()
          }

          // In single view: draw 3D column pillars
          if (mode !== 'matrix' && (i % 3 === 0 || isLatest)) {
            const pb = basePts[i]
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(pb.x, pb.y)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      })

      // 3. Interactive Floating Billboard for Hovered Node
      if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < steps) {
        const item = processedData[hoverIndex]
        const sampleLane = lanes[0]
        if (sampleLane) {
          const val = item[sampleLane.key]
          const norm = Math.max(0, Math.min(1, (val - sampleLane.minVal) / (sampleLane.maxVal - sampleLane.minVal)))
          const y = -45 + norm * 80
          const x = -sceneW / 2 + (sceneW / (steps - 1)) * hoverIndex
          const hp = project({ x, y, z: sampleLane.zPos }, yaw, pitch, w, h, zoom)

          const boxW = 120
          const boxH = 46
          const bx = Math.min(w - boxW - 10, Math.max(10, hp.x - boxW / 2))
          const by = Math.max(10, hp.y - boxH - 14)

          ctx.fillStyle = 'rgba(13, 19, 34, 0.92)'
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.roundRect(bx, by, boxW, boxH, 8)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
          ctx.font = '10px Plus Jakarta Sans, sans-serif'
          ctx.fillText(`TIME: ${item.time}`, bx + 10, by + 16)

          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif'
          if (mode === 'matrix') {
            ctx.fillText(`${item.temp}°C · ${item.hum}% · ${item.air}AQI`, bx + 10, by + 34)
          } else {
            ctx.fillText(`${sampleLane.name}: ${val} ${sampleLane.unit}`, bx + 10, by + 34)
          }
        }
      }

      ctx.restore()
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [processedData, mode, autoRotate, hoverIndex])

  // Pointer & Touch handlers for interactive 3D rotation
  const handlePointerDown = (e: React.PointerEvent) => {
    const cam = cameraRef.current
    cam.isDragging = true
    cam.lastMouseX = e.clientX
    cam.lastMouseY = e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const cam = cameraRef.current
    if (!cam.isDragging) {
      // Find nearest data point along X axis for hover inspection
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const ratio = mouseX / rect.width
        const idx = Math.round(ratio * (processedData.length - 1))
        if (idx >= 0 && idx < processedData.length) {
          setHoverIndex(idx)
        }
      }
      return
    }

    const dx = e.clientX - cam.lastMouseX
    const dy = e.clientY - cam.lastMouseY

    cam.targetYaw += dx * 0.008
    cam.targetPitch = Math.max(0.1, Math.min(1.2, cam.targetPitch + dy * 0.008))

    cam.lastMouseX = e.clientX
    cam.lastMouseY = e.clientY
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const cam = cameraRef.current
    cam.isDragging = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch { }
  }

  const handleResetCamera = () => {
    cameraRef.current.targetYaw = -0.42
    cameraRef.current.targetPitch = 0.44
    cameraRef.current.zoom = 1.0
  }

  return (
    <div
      ref={containerRef}
      className="room-master-card"
      style={{
        display: 'block',
        padding: '20px',
        marginBottom: 20,
        position: 'relative',
        background: 'linear-gradient(135deg, rgba(20, 28, 46, 0.95), rgba(13, 19, 34, 0.98))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        borderRadius: 16,
      }}
    >
      {/* Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-light)' }}>
              <Layers size={16} />
            </span>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Live 3D Environmental Telemetry
            </h4>
            <span
              className="node-pulse-badge"
              style={{
                fontSize: 10,
                padding: '2px 8px',
                background: 'rgba(16, 185, 129, 0.1)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                color: 'var(--green)',
              }}
            >
              <span className="pir-pulse-dot" style={{ width: 6, height: 6, background: 'var(--green)' }} />
              Live Stream
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Real-time multi-dimensional sensor terrain · Drag canvas to rotate 360° in 3D
          </p>
        </div>

        {/* View Switcher Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`master-chip ${mode === 'matrix' ? 'on' : ''}`}
            style={{ fontSize: 11, padding: '4px 10px', height: 'auto', borderRadius: 8 }}
            onClick={() => setMode('matrix')}
          >
            <Sparkles size={12} style={{ marginRight: 4 }} /> 3D Matrix
          </button>
          <button
            className={`master-chip ${mode === 'temperature' ? 'on' : ''}`}
            style={{ fontSize: 11, padding: '4px 10px', height: 'auto', borderRadius: 8 }}
            onClick={() => setMode('temperature')}
          >
            <Thermometer size={12} style={{ marginRight: 4 }} /> Temp
          </button>
          <button
            className={`master-chip ${mode === 'humidity' ? 'on' : ''}`}
            style={{ fontSize: 11, padding: '4px 10px', height: 'auto', borderRadius: 8 }}
            onClick={() => setMode('humidity')}
          >
            <Droplets size={12} style={{ marginRight: 4 }} /> Humidity
          </button>
          <button
            className={`master-chip ${mode === 'air' ? 'on' : ''}`}
            style={{ fontSize: 11, padding: '4px 10px', height: 'auto', borderRadius: 8 }}
            onClick={() => setMode('air')}
          >
            <Wind size={12} style={{ marginRight: 4 }} /> Air (AQI)
          </button>
        </div>
      </div>

      {/* Real-time Metric Value Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div
          onClick={() => setMode('temperature')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: mode === 'temperature' ? 'rgba(255, 107, 107, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${mode === 'temperature' ? 'rgba(255, 107, 107, 0.4)' : 'rgba(255, 255, 255, 0.07)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Thermometer size={13} color="#ff6b6b" /> Temperature
            </span>
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(255, 107, 107, 0.2)', color: '#ff6b6b', fontWeight: 600 }}>
              Live
            </span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ff6b6b', letterSpacing: '-0.02em' }}>
            {currentTemp.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 500 }}>°C</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Comfortable Room Temp</div>
        </div>

        <div
          onClick={() => setMode('humidity')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: mode === 'humidity' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${mode === 'humidity' ? 'rgba(0, 242, 254, 0.4)' : 'rgba(255, 255, 255, 0.07)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Droplets size={13} color="#00f2fe" /> Humidity
            </span>
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(0, 242, 254, 0.2)', color: '#00f2fe', fontWeight: 600 }}>
              Live
            </span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#00f2fe', letterSpacing: '-0.02em' }}>
            {Math.round(currentHum)} <span style={{ fontSize: 12, fontWeight: 500 }}>% RH</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Optimal (40–60%)</div>
        </div>

        <div
          onClick={() => setMode('air')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: mode === 'air' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${mode === 'air' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.07)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Wind size={13} color="#10b981" /> Air Quality
            </span>
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 600 }}>
              Live
            </span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
            {Math.round(currentAir)} <span style={{ fontSize: 12, fontWeight: 500 }}>AQI</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Pure & Fresh Air</div>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 310,
          background: 'rgba(6, 10, 20, 0.85)',
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 2px 14px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', cursor: 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => setHoverIndex(null)}
        />

        {/* Floating 3D Navigation Controls Overlay */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, zIndex: 10 }}>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className="icon-pill-btn"
            style={{
              width: 30,
              height: 30,
              background: autoRotate ? 'rgba(99, 102, 241, 0.3)' : 'rgba(20, 28, 46, 0.7)',
              borderColor: autoRotate ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.1)',
            }}
            title={autoRotate ? 'Pause 3D Orbit' : 'Start 3D Orbit'}
          >
            {autoRotate ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button
            onClick={handleResetCamera}
            className="icon-pill-btn"
            style={{ width: 30, height: 30, background: 'rgba(20, 28, 46, 0.7)', borderColor: 'rgba(255, 255, 255, 0.1)' }}
            title="Reset to Isometric 3D View"
          >
            <Compass size={12} />
          </button>
        </div>

        {/* Legend / Drag Hint Bar at bottom of canvas */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 14,
            right: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            color: 'rgba(255, 255, 255, 0.5)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ff6b6b' }} /> Temp (°C)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#00f2fe' }} /> Hum (%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} /> Air (AQI)
            </span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <RotateCw size={10} /> Drag to orbit
          </span>
        </div>
      </div>
    </div>
  )
}
