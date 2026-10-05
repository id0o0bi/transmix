import { Status, type Torrent, type TrackerStats } from "@/lib/transmission"

export interface CachedTorrent extends Torrent {
  cachedError: string
  cachedMainTracker: string
  cachedTrackerStatus: string
  cachedTrackerDlCount: number
  cachedSeedsTotal: number
  cachedPeersTotal: number
}

function mainTracker(t: Torrent): TrackerStats | undefined {
  return t.trackerStats.find((tracker) => tracker.host !== undefined && !tracker.announce?.includes("_duplicates/"))
    ?? t.trackerStats[0]
}

export function decorateTorrent(t: Torrent): CachedTorrent {
  const tracker = mainTracker(t)

  const cachedError =
    t.errorString !== "" ? t.errorString : t.error !== 0 ? `Error ${t.error}` : ""

  const cachedMainTracker = tracker?.host ?? "<No trackers>"

  const cachedTrackerStatus =
    tracker === undefined
      ? ""
      : tracker.hasAnnounced
        ? (tracker.lastAnnounceResult ?? "")
        : (tracker.lastScrapeResult ?? "")

  const cachedTrackerDlCount = tracker?.downloadCount ?? -1

  let seedsTotal = t.trackerStats.length > 0 ? 0 : -1
  let peersTotal = t.trackerStats.length > 0 ? 0 : -1
  for (const s of t.trackerStats) {
    if (s.seederCount !== undefined && s.seederCount >= 0) seedsTotal += s.seederCount
    if (s.leecherCount !== undefined && s.leecherCount >= 0) peersTotal += s.leecherCount
  }

  return {
    ...t,
    cachedError,
    cachedMainTracker,
    cachedTrackerStatus,
    cachedTrackerDlCount,
    cachedSeedsTotal: seedsTotal,
    cachedPeersTotal: peersTotal,
  }
}

// ---------------------------------------------------------------------------
// Status filters (TrguiNG parity)
// ---------------------------------------------------------------------------

export interface StatusFilterDef {
  id: string
  label: string
  filter: (t: CachedTorrent) => boolean
}

export const statusFilters: StatusFilterDef[] = [
  { id: "all", label: "All Torrents", filter: () => true },
  { id: "downloading", label: "Downloading", filter: (t) => t.status === Status.downloading },
  {
    id: "completed",
    label: "Completed",
    filter: (t) =>
      t.status === Status.seeding ||
      (t.sizeWhenDone > 0 && Math.max(t.sizeWhenDone - t.haveValid, 0) === 0),
  },
  { id: "active", label: "Active", filter: (t) => t.rateDownload > 0 || t.rateUpload > 0 },
  {
    id: "inactive",
    label: "Inactive",
    filter: (t) => t.rateDownload === 0 && t.rateUpload === 0 && t.status !== Status.stopped,
  },
  { id: "running", label: "Running", filter: (t) => t.status !== Status.stopped },
  { id: "stopped", label: "Stopped", filter: (t) => t.status === Status.stopped },
  { id: "error", label: "Error", filter: (t) => t.error !== 0 || t.cachedError !== "" },
  {
    id: "waiting",
    label: "Waiting",
    filter: (t) =>
      t.status === Status.verifying ||
      t.status === Status.queuedToVerify ||
      t.status === Status.queuedToDownload,
  },
  {
    id: "magnetizing",
    label: "Magnetizing",
    filter: (t) => t.status === Status.downloading && t.pieceCount === 0,
  },
]

export const noLabelsFilterId = "nolabels"
export const labelFilterPrefix = "label:"
export const trackerFilterPrefix = "tracker:"
export const dirFilterPrefix = "dir:"

export interface TorrentFilterState {
  status: Set<string>
  labels: Set<string>
  trackers: Set<string>
  dirs: Set<string>
}

export const defaultFilterState = (): TorrentFilterState => ({
  status: new Set(["all"]),
  labels: new Set(),
  trackers: new Set(),
  dirs: new Set(),
})

// Prefs are JSON-serialized, which turns Sets into {}. Save as arrays and
// revive them on load; legacy/corrupt values fall back to defaults.
export function serializeFilterState(state: TorrentFilterState): Record<string, string[]> {
  return {
    status: [...state.status],
    labels: [...state.labels],
    trackers: [...state.trackers],
    dirs: [...state.dirs],
  }
}

export function parseFilterState(raw: unknown): TorrentFilterState {
  const fallback = defaultFilterState()
  if (typeof raw !== "object" || raw === null) return fallback
  const read = (value: unknown, def: Set<string>): Set<string> => {
    if (value instanceof Set) return value
    if (Array.isArray(value)) return new Set(value.filter((v): v is string => typeof v === "string"))
    return def
  }
  const o = raw as Record<string, unknown>
  return {
    status: read(o.status, fallback.status),
    labels: read(o.labels, fallback.labels),
    trackers: read(o.trackers, fallback.trackers),
    dirs: read(o.dirs, fallback.dirs),
  }
}

export function activeFilterCount(state: TorrentFilterState): number {
  let count = state.status.has("all") ? 0 : state.status.size
  count += state.labels.size + state.trackers.size + state.dirs.size
  return count
}

// ---------------------------------------------------------------------------
// Search: plain terms match name/path, `label:x` / `path:x` are prefixed
// ---------------------------------------------------------------------------

export function parseSearchTerms(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== "")
}

export function matchesSearch(t: CachedTorrent, terms: string[]): boolean {
  if (terms.length === 0) return true
  const name = t.name.toLowerCase()
  const path = t.downloadDir.toLowerCase()
  const labels = t.labels.map((l) => l.toLowerCase())

  return terms.every((term) => {
    if (term.startsWith("label:")) {
      const needle = term.slice("label:".length)
      return labels.some((l) => l.includes(needle))
    }
    if (term.startsWith("path:")) {
      return path.includes(term.slice("path:".length))
    }
    return name.includes(term) || path.includes(term)
  })
}

export function filterTorrents(
  torrents: CachedTorrent[],
  filters: TorrentFilterState,
  searchTerms: string[],
): CachedTorrent[] {
  const statusDefs = statusFilters.filter(
    (f) => f.id !== "all" && filters.status.has(f.id),
  )
  const useAll = filters.status.has("all") || statusDefs.length === 0

  return torrents.filter((t) => {
    if (!useAll && !statusDefs.some((f) => f.filter(t))) return false

    if (filters.labels.size > 0) {
      const ok =
        (filters.labels.has(noLabelsFilterId) && t.labels.length === 0) ||
        t.labels.some((l) => filters.labels.has(l))
      if (!ok) return false
    }

    if (filters.trackers.size > 0 && !filters.trackers.has(t.cachedMainTracker)) return false

    if (filters.dirs.size > 0 && !filters.dirs.has(t.downloadDir)) return false

    return matchesSearch(t, searchTerms)
  })
}

// ---------------------------------------------------------------------------
// Progress bar coloring (TrguiNG parity)
// ---------------------------------------------------------------------------

export type ProgressVariant = "default" | "red" | "yellow" | "green" | "dark-green" | "grey"

export function progressVariant(t: CachedTorrent): ProgressVariant {
  if (t.error !== 0 || t.cachedError !== "") return "red"
  if (t.status === Status.stopped && t.sizeWhenDone > 0) {
    return t.leftUntilDone === 0 ? "dark-green" : "yellow"
  }
  if (t.status === Status.seeding) return "green"
  if (
    t.status === Status.queuedToVerify ||
    t.status === Status.queuedToDownload ||
    t.status === Status.queuedToSeed
  ) {
    return "grey"
  }
  return "default"
}

export const progressVariantClasses: Record<ProgressVariant, string> = {
  default: "bg-blue-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  green: "bg-emerald-500",
  "dark-green": "bg-green-700",
  grey: "bg-zinc-400 dark:bg-zinc-500",
}
