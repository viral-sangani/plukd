'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { ProcessingTimeData } from '@/lib/hooks/use-admin-stats'

interface ProcessingChartProps {
  data: ProcessingTimeData[]
  className?: string
}

export function ProcessingChart({ data, className }: ProcessingChartProps) {
  // Format date for display
  const formattedData = data.map((item) => ({
    ...item,
    displayDate: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }))

  return (
    <div className={cn('bg-[#0a0a0a] border border-zinc-900 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-zinc-500">
          Processing Time (7D)
        </span>
        <span className="text-[10px] font-mono text-zinc-600">
          avg seconds
        </span>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#27272a"
              vertical={false}
            />
            <XAxis
              dataKey="displayDate"
              tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: '#27272a' }}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}s`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
            />
            <Bar
              dataKey="avgTime"
              fill="#22c55e"
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    payload: ProcessingTimeData & { displayDate: string }
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0]

  return (
    <div className="bg-[#111111] border border-zinc-800 px-3 py-2 shadow-lg">
      <p className="text-xs font-mono text-zinc-400 mb-1">
        {data.payload.displayDate}
      </p>
      <p className="text-sm font-mono text-white">
        {data.value.toFixed(2)}s avg
      </p>
      <p className="text-xs font-mono text-zinc-500">
        {data.payload.count} processed
      </p>
    </div>
  )
}

interface SourceDistributionChartProps {
  data: Array<{
    source: string
    count: number
    percentage: number
  }>
  className?: string
}

const SOURCE_COLORS: Record<string, string> = {
  twitter: '#1da1f2',
  instagram: '#e1306c',
  web: '#a1a1a1',
  reddit: '#ff4500',
  linkedin: '#0077b5',
  youtube: '#ff0000',
  other: '#6b7280',
}

export function SourceDistributionChart({
  data,
  className,
}: SourceDistributionChartProps) {
  // Sort by count descending
  const sortedData = [...data].sort((a, b) => b.count - a.count)

  return (
    <div className={cn('bg-[#0a0a0a] border border-zinc-900 p-4', className)}>
      <div className="mb-4">
        <span className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-zinc-500">
          Bookmarks by Source
        </span>
      </div>

      <div className="space-y-3">
        {sortedData.map((item) => (
          <SourceBar
            key={item.source}
            source={item.source}
            count={item.count}
            percentage={item.percentage}
          />
        ))}
      </div>
    </div>
  )
}

interface SourceBarProps {
  source: string
  count: number
  percentage: number
}

function SourceBar({ source, count, percentage }: SourceBarProps) {
  const color = SOURCE_COLORS[source.toLowerCase()] || SOURCE_COLORS.other

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono capitalize text-zinc-400 group-hover:text-white transition-colors">
          {source}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono tabular-nums text-white">
            {count.toLocaleString()}
          </span>
          <span className="text-xs font-mono tabular-nums text-zinc-500">
            ({percentage.toFixed(1)}%)
          </span>
        </div>
      </div>
      <div className="h-2 bg-zinc-900 overflow-hidden">
        <div
          className="h-full transition-all duration-300 group-hover:opacity-90"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}
