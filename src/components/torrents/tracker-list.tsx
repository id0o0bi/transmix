import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/hooks/use-session"
import { useTorrentActions } from "@/hooks/use-torrent-actions"
import { useTorrentTrackers, type TorrentTrackerEntry } from "@/hooks/use-torrent-detail"
import { getOriginalTrackers, seedOriginalTrackers } from "@/lib/original-trackers"
import { rpc, trackerNextUpdateText } from "@/lib/transmission"
import { cn } from "@/lib/utils"

function trackerStatus(stats: TorrentTrackerEntry["stats"]): string {
  if (stats === undefined) return "—"
  if (stats.announceState === 3) return "Updating"
  if (stats.hasAnnounced === true && stats.lastAnnounceSucceeded === true) return "Working"
  if (stats.lastAnnounceResult === "Success") return "Working"
  if (stats.lastAnnounceResult !== undefined && stats.lastAnnounceResult !== "") {
    return stats.lastAnnounceResult
  }
  return "—"
}

function HeadCell(props: { label: string; className?: string; right?: boolean }) {
  return (
    <span className={cn("shrink-0 truncate", props.right && "text-right", props.className)}>
      {props.label}
    </span>
  )
}

function parseTrackerLines(input: string): string[] {
  const deduped: string[] = []
  for (const raw of input.split("\n")) {
    const line = raw.trim()
    if (line !== "" && deduped.includes(line)) continue
    if (line === "" && (deduped.length === 0 || deduped[deduped.length - 1] === "")) continue
    deduped.push(line)
  }
  return deduped
}

/** Rebuild trackerList text from tiered trackers (rpc < 17 has no trackerList field). */
function serializeTrackerTiers(trackers: TorrentTrackerEntry[]): string {
  const lines: string[] = []
  let prevTier: number | null = null
  const seen = new Set<string>()
  for (const tr of trackers) {
    if (tr.announce === "" || seen.has(tr.announce)) continue
    if (prevTier !== null && tr.tier !== prevTier) lines.push("")
    lines.push(tr.announce)
    seen.add(tr.announce)
    prevTier = tr.tier
  }
  return lines.join("\n")
}

export function TrackerList({ torrentId }: { torrentId: number }) {
  const { data, isLoading, isError, error } = useTorrentTrackers(torrentId)
  const actions = useTorrentActions()
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const rpcVersion = useSession().data?.["rpc-version"] ?? 17

  const trackers = data?.trackers ?? []

  // Snapshot the original trackers on first sight (never overwritten later).
  useEffect(() => {
    if (data === undefined || data.hashString === "") return
    const list = data.trackerList ?? serializeTrackerTiers(data.trackers)
    seedOriginalTrackers(data.hashString, list)
  }, [data])

  const add = () => {
    const value = url.trim()
    if (value === "" || busy) return
    setBusy(true)
    void actions.setFields([torrentId], { trackerAdd: [value] }).then((ok) => {
      setBusy(false)
      if (ok) {
        setUrl("")
        setAdding(false)
      }
    })
  }

  const remove = (trackerId: number) => {
    void actions.setFields([torrentId], { trackerRemove: [trackerId] })
  }

  const startEdit = () => {
    const fallback = trackers.map((tr) => tr.announce).join("\n")
    setText(fallback)
    setEditing(true)
    if (rpcVersion >= 17) {
      void rpc
        .torrentGet<{ trackerList: string }>(["trackerList"], torrentId)
        .then(({ torrents }) => {
          const list = torrents[0]?.trackerList
          setText((prev) => (prev === fallback && typeof list === "string" ? list : prev))
        })
        .catch(() => undefined)
    }
  }

  const cancelEdit = () => {
    setEditing(false)
    setText(null)
  }

  const saveEdit = () => {
    if (text === null || busy) return
    const lines = parseTrackerLines(text)
    const fields: Record<string, unknown> = {}
    if (rpcVersion >= 17) {
      fields.trackerList = lines.join("\n")
    } else {
      const wanted = lines.filter((l) => l !== "")
      const current = new Map(trackers.map((tr) => [tr.announce, tr.id]))
      const toAdd = wanted.filter((u) => !current.has(u))
      const toRemove = trackers.filter((tr) => !wanted.includes(tr.announce)).map((tr) => tr.id)
      if (toAdd.length > 0) fields.trackerAdd = toAdd
      if (toRemove.length > 0) fields.trackerRemove = toRemove
      if (toAdd.length === 0 && toRemove.length === 0) {
        cancelEdit()
        return
      }
    }
    setBusy(true)
    void actions.setFields([torrentId], fields).then((ok) => {
      setBusy(false)
      if (ok) cancelEdit()
    })
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        Loading trackers…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
        Failed to load trackers: {error instanceof Error ? error.message : String(error)}
      </div>
    )
  }

  if (editing) {
    const original =
      data !== undefined && data.hashString !== ""
        ? getOriginalTrackers(data.hashString)
        : null
    return (
      <div className="absolute inset-0 flex flex-col p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            One tracker per line, empty line between tiers.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={() => {
              if (original !== null) setText(original)
            }}
            disabled={original === null || text === original}
            aria-label="Restore original trackers"
            title="Fill in the trackers this torrent/magnet came with (as first seen in transmix)"
          >
            <RotateCcw className="size-3.5" />
            Restore original
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={cancelEdit}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={saveEdit}
            disabled={busy || text === null}
          >
            Save
          </Button>
        </div>
        <Textarea
          value={text ?? ""}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          aria-label="Tracker list"
          className="min-h-0 flex-1 resize-none font-mono text-xs"
          autoFocus
        />
      </div>
    )
  }

  const showAdd = adding || trackers.length === 0

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="sticky top-0 z-10 flex h-9 min-w-[640px] items-center gap-2 border-b bg-background px-3 text-xs font-medium text-muted-foreground">
        <HeadCell label="Tracker" className="min-w-0 flex-1" />
        <HeadCell label="Seeds" className="w-14" right />
        <HeadCell label="Leechers" className="w-16" right />
        <HeadCell label="Downloads" className="w-20" right />
        <HeadCell label="Next update" className="w-24" right />
        <HeadCell label="Status" className="w-28" />
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setAdding((a) => !a)}
          aria-label="Add tracker"
          aria-expanded={showAdd}
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={startEdit}
          aria-label="Edit tracker list"
          title="Edit tracker list"
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>

      {showAdd && (
        <div className="flex min-w-[640px] items-center gap-1.5 border-b bg-muted/30 px-3 py-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add()
            }}
            placeholder="https://tracker.example.com/announce"
            className="h-8 min-w-0 flex-1 text-xs"
            aria-label="New tracker URL"
            autoFocus={adding}
          />
          <Button
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={add}
            disabled={url.trim() === "" || busy}
          >
            Add
          </Button>
        </div>
      )}

      {trackers.length === 0 ? (
        <div className="flex h-20 min-w-[640px] items-center justify-center text-sm text-muted-foreground">
          No trackers.
        </div>
      ) : (
        trackers.map((tr) => {
          const stats = tr.stats
          const label = tr.announce !== "" ? tr.announce : (stats?.host ?? "")
          const result = stats?.lastAnnounceResult ?? ""
          const seeds = stats?.seederCount ?? -1
          const leechers = stats?.leecherCount ?? -1
          const downloads = stats?.downloadCount ?? -1
          const status = trackerStatus(stats)
          return (
            <div
              key={tr.id}
              className="flex h-9 min-w-[640px] items-center gap-2 px-3 text-xs odd:bg-accent/30 hover:bg-accent/50"
            >
              <span className="min-w-0 flex-1 truncate" title={label}>
                {label}
              </span>
              <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
                {seeds >= 0 ? seeds : "—"}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                {leechers >= 0 ? leechers : "—"}
              </span>
              <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
                {downloads >= 0 ? downloads : "—"}
              </span>
              <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                {trackerNextUpdateText(stats)}
              </span>
              <span className="w-28 shrink-0 truncate text-muted-foreground" title={result}>
                {status}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(tr.id)}
                aria-label={`Remove tracker ${label}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )
        })
      )}
    </div>
  )
}
