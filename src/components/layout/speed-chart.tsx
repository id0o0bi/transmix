import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatSpeed } from "@/lib/format"
import type { SpeedPoint } from "@/hooks/use-speed-history"

interface SpeedChartProps {
  points: SpeedPoint[]
  /** Chart height in px. */
  height: number
  /** Show axes/grid (for the expanded graph dialog). */
  showAxis?: boolean
}

interface TooltipPayloadItem {
  dataKey?: string | number
  value?: number | null
}

function ChartTooltip(props: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: number
}) {
  if (!props.active || !props.payload || props.payload.length === 0) return null
  const time = typeof props.label === "number" ? new Date(props.label).toLocaleTimeString() : ""
  return (
    <div className="rounded-md border bg-background px-2 py-1.5 text-xs shadow-md">
      <div className="mb-1 text-muted-foreground">{time}</div>
      {props.payload.map((item) => (
        <div key={String(item.dataKey)} className="flex items-center gap-1.5 tabular-nums">
          <span
            className={
              item.dataKey === "down" ? "size-2 rounded-full bg-sky-500" : "size-2 rounded-full bg-emerald-500"
            }
          />
          <span className="text-muted-foreground">{item.dataKey === "down" ? "Down" : "Up"}</span>
          <span className="font-medium">{formatSpeed(item.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

export function SpeedChart({ points, height, showAxis = false }: SpeedChartProps) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
        style={{ height }}
      >
        Collecting speed data…
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={showAxis ? { top: 16, right: 8, left: 0, bottom: 4 } : { top: 6, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="speedDownFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="speedUpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {showAxis && <CartesianGrid strokeDasharray="3 3" className="stroke-border" />}
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          hide={!showAxis}
          tickFormatter={(value: number) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          tick={{ fontSize: 11 }}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <YAxis
          hide={!showAxis}
          tickFormatter={(value: number) => formatSpeed(value).replace("/s", "")}
          tick={{ fontSize: 11 }}
          width={70}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} />
        <Area
          type="monotone"
          dataKey="down"
          stroke="#0ea5e9"
          strokeWidth={1.5}
          fill="url(#speedDownFill)"
          isAnimationActive={false}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="up"
          stroke="#10b981"
          strokeWidth={1.5}
          fill="url(#speedUpFill)"
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
