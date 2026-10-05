import { useEffect, useMemo, useState } from "react"
import { useTorrentPeers } from "@/hooks/use-torrent-detail"
import { countryFor, ensureCountries, flagEmoji, isPeerGeoEnabled } from "@/lib/geoip"
import { flagsTooltip } from "@/lib/peer-flags"
import type { Peer } from "@/lib/transmission"
import { formatSpeed } from "@/lib/format"
import { cn } from "@/lib/utils"

function HeadCell(props: { label: string; className?: string; center?: boolean }) {
  return (
    <span
      className={cn("shrink-0 truncate", props.center && "text-center", props.className)}
    >
      {props.label}
    </span>
  )
}

function sameCountries(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((k) => a[k] === b[k])
}

export function PeerList({ torrentId }: { torrentId: number }) {
  const { data, isLoading, isError, error } = useTorrentPeers(torrentId)
  const peers = useMemo<Peer[]>(() => data ?? [], [data])
  const geoOn = isPeerGeoEnabled()
  const [countries, setCountries] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!geoOn) return
    let alive = true
    void ensureCountries(peers.map((p) => p.address)).then(() => {
      if (!alive) return
      const next: Record<string, string> = {}
      for (const p of peers) {
        const cc = countryFor(p.address)
        if (cc !== null) next[p.address] = cc
      }
      setCountries((prev) => (sameCountries(prev, next) ? prev : next))
    })
    return () => {
      alive = false
    }
  }, [peers, geoOn])

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        Loading peers…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
        Failed to load peers: {error instanceof Error ? error.message : String(error)}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b bg-background px-3 text-xs font-medium text-muted-foreground">
        <HeadCell label="Address" className="min-w-0 flex-1" />
        <HeadCell label="Client" className="w-36" />
        <HeadCell label="Enc" className="w-10" center />
        <HeadCell label="Flags" className="w-14" center />
        <HeadCell label="Progress" className="w-14 text-right" />
        <HeadCell label="Down" className="w-20 text-right" />
        <HeadCell label="Up" className="w-20 text-right" />
      </div>

      {peers.length === 0 ? (
        <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
          No connected peers.
        </div>
      ) : (
        peers.map((p, i) => (
          <div
            key={`${p.address}:${p.port ?? i}`}
            className="flex h-8 items-center gap-2 px-3 text-xs odd:bg-accent/30 hover:bg-accent/50"
            title={`${p.address}${p.port !== undefined ? `:${p.port}` : ""}${p.clientName !== undefined ? ` · ${p.clientName}` : ""}`}
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5 font-mono">
              {countries[p.address] !== undefined && (
                <span aria-hidden="true">{flagEmoji(countries[p.address])}</span>
              )}
              <span className="truncate">{p.address}</span>
            </span>
            <span className="w-36 shrink-0 truncate text-muted-foreground">
              {p.clientName ?? "unknown"}
            </span>
            <span className="w-10 shrink-0 text-center">
              {p.flagStr !== undefined && p.flagStr.includes("E") ? "Yes" : "No"}
            </span>
            <span
              className="w-14 shrink-0 truncate text-center font-mono text-muted-foreground"
              title={flagsTooltip(p.flagStr)}
            >
              {p.flagStr ?? ""}
            </span>
            <span className="w-14 shrink-0 text-right tabular-nums">
              {Math.round((p.progress ?? 0) * 100)}%
            </span>
            <span className="w-20 shrink-0 text-right tabular-nums">
              {(p.rateToClient ?? 0) > 0 ? formatSpeed(p.rateToClient ?? 0) : "—"}
            </span>
            <span className="w-20 shrink-0 text-right tabular-nums">
              {(p.rateToPeer ?? 0) > 0 ? formatSpeed(p.rateToPeer ?? 0) : "—"}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
