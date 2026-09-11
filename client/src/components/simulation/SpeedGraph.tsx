import React, { useMemo } from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { TrendingUp } from 'lucide-react'

export const SpeedGraph: React.FC = () => {
  const { trains } = useSimulation()

  const speedData = useMemo(() => {
    const trainList = Array.from(trains.values())
    if (trainList.length === 0) return null

    // Use GPS speed in km/h, convert to m/s for display
    const speeds = trainList.map((t) => t.gps?.speed || t.speed * 3.6 || 0)
    const maxSpeedKmh = Math.max(...speeds, 1)
    const maxSpeedMs = maxSpeedKmh / 3.6
    const graphHeight = 80
    const graphWidth = 200
    const padding = 10

    const points = trainList.map((train, idx) => {
      const speedKmh = train.gps?.speed || train.speed * 3.6 || 0
      const speedMs = speedKmh / 3.6
      const x =
        padding +
        (idx / Math.max(trainList.length - 1, 1)) * (graphWidth - 2 * padding)
      const y =
        padding + (1 - speedKmh / maxSpeedKmh) * (graphHeight - 2 * padding)
      return { x, y, trainId: train.id, speed: speedMs, speedKmh }
    })

    return { points, maxSpeed: maxSpeedMs, maxSpeedKmh, graphWidth, graphHeight }
  }, [trains])

  if (!speedData || speedData.points.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Speed
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">No data</p>
      </div>
    )
  }

  const pathData = speedData.points
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" />
        Speed
      </h3>
      <div className="relative">
        <svg
          width={speedData.graphWidth}
          height={speedData.graphHeight}
          className="border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-900"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = 10 + ratio * (speedData.graphHeight - 20)
            return (
              <line
                key={ratio}
                x1={10}
                x2={speedData.graphWidth - 10}
                y1={y}
                y2={y}
                className="stroke-gray-100 dark:stroke-slate-700"
                strokeWidth={0.5}
                strokeDasharray="2,2"
              />
            )
          })}
          {/* Speed line */}
          <path
            d={pathData}
            fill="none"
            className="stroke-gray-900 dark:stroke-gray-100"
            strokeWidth={1.5}
          />
          {/* Data points */}
          {speedData.points.map((point, idx) => (
            <g key={idx}>
              <circle
                cx={point.x}
                cy={point.y}
                r={2.5}
                className="fill-gray-900 dark:fill-gray-100 stroke-white dark:stroke-slate-900"
                strokeWidth={1}
              />
              <title>{`${point.trainId}: ${point.speed.toFixed(1)} m/s`}</title>
            </g>
          ))}
          {/* Y-axis labels */}
          {[0, 0.5, 1].map((ratio) => {
            const speedKmh = speedData.maxSpeedKmh * (1 - ratio)
            const y = 10 + ratio * (speedData.graphHeight - 20)
            return (
              <text
                key={ratio}
                x={5}
                y={y + 3}
                className="fill-gray-400 dark:fill-gray-500"
                fontSize="7"
                textAnchor="end"
              >
                {speedKmh.toFixed(0)}
              </text>
            )
          })}
        </svg>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Max: {speedData.maxSpeedKmh.toFixed(1)} km/h ({speedData.maxSpeed.toFixed(1)} m/s) • {speedData.points.length} trains
        </div>
      </div>
    </div>
  )
}
