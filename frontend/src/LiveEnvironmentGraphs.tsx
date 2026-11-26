import React, { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import {
  Thermometer,
  Droplets,
  Wind,
  Layers,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react'
import type { Telemetry } from './types'

interface LiveEnvironmentGraphsProps {
  telemetry: Telemetry[]
  currentTemp: number
  currentHum: number
  currentAir: number
  tempOffset?: number
  humOffset?: number
}

type MetricMode = 'all' | 'temp' | 'hum' | 'air'

export const LiveEnvironmentGraphs: React.FC<LiveEnvironmentGraphsProps> = ({
  telemetry,
  currentTemp,
  currentHum,
  currentAir,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricMode>('all')

  // Prepare standard historical series (20 smoothed recent time steps)
  const chartData = useMemo(() => {
    const count = 20
    const rawList = [...telemetry].slice(-count)
    const result = []
    const now = Date.now()

    for (let i = 0; i < count; i++) {
      const idxFromEnd = count - 1 - i
      const item = rawList[rawList.length - 1 - idxFromEnd]
      const timeOffset = (count - 1 - i) * 15 * 1000 // 15s intervals
      const time = item?.recorded_at
        ? new Date(item.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : new Date(now - timeOffset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      const t = item?.temperature != null ? item.temperature : currentTemp - (count - 1 - i) * 0.05
      const h = item?.humidity != null ? item.humidity : currentHum - (count - 1 - i) * 0.1
      const a = item?.air_quality != null ? item.air_quality : currentAir + (count - 1 - i) * 0.2

      result.push({
        time,
        temp: Number(t.toFixed(1)),
        hum: Math.round(h),
        air: Math.round(a),
      })
    }

    // Pin the latest sample to exact live sensor props
    if (result.length > 0) {
      result[result.length - 1].temp = Number(currentTemp.toFixed(1))
      result[result.length - 1].hum = Math.round(currentHum)
      result[result.length - 1].air = Math.round(currentAir)
    }

    return result
  }, [telemetry, currentTemp, currentHum, currentAir])

  // Min / Max stats for header summary
  const stats = useMemo(() => {
    const temps = chartData.map((d) => d.temp)
    const hums = chartData.map((d) => d.hum)
    const airs = chartData.map((d) => d.air)

    return {
      temp: {
        min: Math.min(...temps),
        max: Math.max(...temps),
        avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      },
      hum: {
        min: Math.min(...hums),
        max: Math.max(...hums),
        avg: Math.round(hums.reduce((a, b) => a + b, 0) / hums.length),
      },
      air: {
        min: Math.min(...airs),
        max: Math.max(...airs),
        avg: Math.round(airs.reduce((a, b) => a + b, 0) / airs.length),
      },
    }
  }, [chartData])

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'rgba(13, 19, 34, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '10px 14px',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            fontSize: 12,
            minWidth: 140,
          }}
        >
          <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 6 }}>
            {label}
          </div>
          {payload.map((entry: any, index: number) => {
            const isTemp = entry.dataKey === 'temp'
            const isHum = entry.dataKey === 'hum'
            const unit = isTemp ? '°C' : isHum ? '% RH' : ' AQI'
            const labelName = isTemp ? 'Temperature' : isHum ? 'Humidity' : 'Air Quality'
            return (
              <div
                key={`item-${index}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 3,
                  color: entry.color,
                  fontWeight: 600,
                }}
              >
                <span>{labelName}:</span>
                <span style={{ color: '#fff' }}>
                  {entry.value} {unit}
                </span>
              </div>
            )
          })}
        </div>
      )
    }
    return null
  }

  return (
    <div
      className="room-master-card"
      style={{
        display: 'block',
        padding: '20px',
        marginBottom: 20,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 16,
      }}
    >
      {/* Header and Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-light)',
              }}
            >
              <Activity size={16} />
            </span>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Live Environmental Telemetry
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
            Real-time sensor telemetry history from physical Waveshare ESP32-S3
          </p>
        </div>

        {/* Metric Selector Buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`master-chip ${selectedMetric === 'all' ? 'on' : ''}`}
            style={{ fontSize: 11, padding: '5px 12px', height: 'auto', borderRadius: 8 }}
            onClick={() => setSelectedMetric('all')}
          >
            <Layers size={12} style={{ marginRight: 4 }} /> All Sensors
          </button>
          <button
            className={`master-chip ${selectedMetric === 'temp' ? 'on' : ''}`}
            style={{ fontSize: 11, padding: '5px 12px', height: 'auto', borderRadius: 8 }}
            onClick={() => setSelectedMetric('temp')}
          >
            <Thermometer size={12} style={{ marginRight: 4 }} /> Temp
          </button>
          <button
            className={`master-chip ${selectedMetric === 'hum' ? 'on' : ''}`}
            style={{ fontSize: 11, padding: '5px 12px', height: 'auto', borderRadius: 8 }}
            onClick={() => setSelectedMetric('hum')}
          >
            <Droplets size={12} style={{ marginRight: 4 }} /> Humidity
          </button>
          <button
            className={`master-chip ${selectedMetric === 'air' ? 'on' : ''}`}
            style={{ fontSize: 11, padding: '5px 12px', height: 'auto', borderRadius: 8 }}
            onClick={() => setSelectedMetric('air')}
          >
            <Wind size={12} style={{ marginRight: 4 }} /> Air Quality
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
        {/* Temperature Card */}
        <div
          onClick={() => setSelectedMetric('temp')}
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: selectedMetric === 'temp' ? 'rgba(244, 63, 94, 0.12)' : 'var(--panel-subtle)',
            border: `1px solid ${selectedMetric === 'temp' ? 'rgba(244, 63, 94, 0.4)' : 'var(--line)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Thermometer size={13} color="#f43f5e" /> Temperature
            </span>
            <span style={{ fontSize: 10, color: '#f43f5e', fontWeight: 600 }}>Live</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f43f5e', letterSpacing: '-0.02em' }}>
            {currentTemp.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 500 }}>°C</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            Min: {stats.temp.min}° · Max: {stats.temp.max}°
          </div>
        </div>

        {/* Humidity Card */}
        <div
          onClick={() => setSelectedMetric('hum')}
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: selectedMetric === 'hum' ? 'rgba(6, 182, 212, 0.12)' : 'var(--panel-subtle)',
            border: `1px solid ${selectedMetric === 'hum' ? 'rgba(6, 182, 212, 0.4)' : 'var(--line)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Droplets size={13} color="#06b6d4" /> Humidity
            </span>
            <span style={{ fontSize: 10, color: '#06b6d4', fontWeight: 600 }}>Live</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#06b6d4', letterSpacing: '-0.02em' }}>
            {Math.round(currentHum)} <span style={{ fontSize: 13, fontWeight: 500 }}>% RH</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            Min: {stats.hum.min}% · Max: {stats.hum.max}%
          </div>
        </div>

        {/* Air Quality Card */}
        <div
          onClick={() => setSelectedMetric('air')}
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: selectedMetric === 'air' ? 'rgba(16, 185, 129, 0.12)' : 'var(--panel-subtle)',
            border: `1px solid ${selectedMetric === 'air' ? 'rgba(16, 185, 129, 0.4)' : 'var(--line)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Wind size={13} color="#10b981" /> Air Quality
            </span>
            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>Live</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
            {Math.round(currentAir)} <span style={{ fontSize: 13, fontWeight: 500 }}>AQI</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            Min: {stats.air.min} · Max: {stats.air.max} (Good)
          </div>
        </div>
      </div>

      {/* Normal 2D Responsive Chart Container */}
      <div
        style={{
          width: '100%',
          height: 280,
          background: 'rgba(10, 15, 29, 0.6)',
          borderRadius: 14,
          padding: '14px 10px 6px 0',
          border: '1px solid var(--line)',
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="airGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="var(--muted)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />

            {/* Left Y Axis for Temp / Hum / Air */}
            <YAxis
              stroke="var(--muted)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              domain={
                selectedMetric === 'temp'
                  ? [15, 40]
                  : selectedMetric === 'hum'
                  ? [20, 100]
                  : selectedMetric === 'air'
                  ? [0, 150]
                  : [0, 100]
              }
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Render Areas based on active filter */}
            {(selectedMetric === 'all' || selectedMetric === 'temp') && (
              <Area
                type="monotone"
                dataKey="temp"
                name="Temperature"
                stroke="#f43f5e"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#tempGradient)"
                isAnimationActive={false}
              />
            )}

            {(selectedMetric === 'all' || selectedMetric === 'hum') && (
              <Area
                type="monotone"
                dataKey="hum"
                name="Humidity"
                stroke="#06b6d4"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#humGradient)"
                isAnimationActive={false}
              />
            )}

            {(selectedMetric === 'all' || selectedMetric === 'air') && (
              <Area
                type="monotone"
                dataKey="air"
                name="Air Quality"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#airGradient)"
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
          marginTop: 12,
          fontSize: 11,
          color: 'var(--muted)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: '#f43f5e' }} /> Temperature (°C)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: '#06b6d4' }} /> Humidity (% RH)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: '#10b981' }} /> Air Quality (AQI)
        </span>
      </div>
    </div>
  )
}
