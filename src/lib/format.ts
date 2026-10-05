const UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] as const

export function formatBytes(bytes: number, precision = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exp
  return `${value.toFixed(exp === 0 ? 0 : precision)} ${UNITS[exp]}`
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0 B/s"
  return `${formatBytes(bytesPerSecond)}/s`
}

export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return "0.0%"
  const clamped = Math.min(1, Math.max(0, fraction))
  // Floor to one decimal (TrguiNG parity): never display 100.0% while bytes remain.
  const pct = Math.floor(clamped * 1000) / 10
  return `${pct.toFixed(1)}%`
}

export function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ""
  let duration = {
    days: Math.floor(value / 86400),
    hours: Math.floor(value / 3600) % 24,
    minutes: Math.floor(value / 60) % 60,
    seconds: Math.floor(value % 60),
  }
  if (duration.days >= 10) duration = { days: duration.days, hours: 0, minutes: 0, seconds: 0 }
  else if (duration.days > 0) duration = { ...duration, minutes: 0, seconds: 0 }
  else if (duration.hours > 0) duration.seconds = 0

  const parts: string[] = []
  if (duration.days > 0) parts.push(`${duration.days}d`)
  if (duration.hours > 0) parts.push(`${duration.hours}hr`)
  if (duration.minutes > 0) parts.push(`${duration.minutes}min`)
  if (duration.seconds > 0) parts.push(`${duration.seconds}s`)
  return parts.join(" ")
}

/** Transmission ETA: -1 = not available, -2 = infinite. */
export function formatEta(seconds: number): string {
  if (seconds < 0) return seconds === -2 ? "∞" : ""
  return formatDuration(seconds)
}

export function formatDate(timestamp: number): string {
  if (timestamp <= 0) return "-"
  return new Date(timestamp * 1000).toLocaleString()
}

export function formatDateDiff(timestamp: number): string {
  if (timestamp <= 0) return "-"
  const seconds = Math.floor(Date.now() / 1000) - timestamp
  if (seconds < 30) return "now"
  const diff = formatDuration(seconds)
  return diff === "" ? "now" : `${diff} ago`
}
