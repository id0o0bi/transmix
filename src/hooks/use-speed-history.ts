import { useEffect, useRef, useState } from "react"
import type { CachedTorrent } from "@/lib/torrents"

export interface SpeedPoint {
  t: number
  down: number
  up: number
}

const MAX_POINTS = 120
const MIN_INTERVAL_MS = 900

/**
 * Samples the summed per-torrent rates from each torrent-list poll (1s),
 * keeping a rolling window for the sidebar speed chart. No extra RPC traffic.
 */
export function useSpeedHistory(torrents: CachedTorrent[] | undefined): SpeedPoint[] {
  const [points, setPoints] = useState<SpeedPoint[]>([])
  const lastSampleRef = useRef(0)

  useEffect(() => {
    if (torrents === undefined) return
    const now = Date.now()
    if (now - lastSampleRef.current < MIN_INTERVAL_MS) return
    lastSampleRef.current = now

    let down = 0
    let up = 0
    for (const t of torrents) {
      down += t.rateDownload
      up += t.rateUpload
    }

    setPoints((prev) => {
      const next = [...prev, { t: now, down, up }]
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
    })
  }, [torrents])

  return points
}
