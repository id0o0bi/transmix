import { useEffect } from "react"
import { useSessionStats } from "@/hooks/use-session"
import { formatSpeed } from "@/lib/format"

/** Live tab title: "↓ 120 KiB/s ↑ 80 KiB/s - TransMix" (static "TransMix" until first stats fetch). */
export function useDocumentTitle(): void {
  const stats = useSessionStats()
  useEffect(() => {
    if (stats.data === undefined) return
    const down = formatSpeed(stats.data.downloadSpeed)
    const up = formatSpeed(stats.data.uploadSpeed)
    document.title = `↓ ${down} ↑ ${up} - TransMix`
  }, [stats.data])
}
