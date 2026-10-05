import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import {
  formatBytes,
  formatDate,
  formatDateDiff,
  formatDuration,
  formatEta,
  formatPercent,
  formatSpeed,
} from "@/lib/format"
import {
  PriorityStrings,
  Status,
  StatusStrings,
  type PriorityNumberType,
} from "@/lib/transmission"
import { progressVariant, type CachedTorrent } from "@/lib/torrents"
import { StatusIcon } from "@/components/torrents/status-icon"
import { ProgressBar } from "@/components/torrents/progress-bar"

export interface FieldDef {
  id: string
  label: string
  /** RPC fields required to render/sort/filter this field. */
  rpcFields: string[]
  width: number
  align: "left" | "right" | "center"
  /** Plain text value (used for rich-line chips; empty = chip omitted). */
  text: (t: CachedTorrent) => string
  /** Rich-line chip text override. Defaults to `${label}: ${text}`. */
  richText?: (t: CachedTorrent) => string
  /** Full cell renderer override (defaults to text). */
  cell?: (t: CachedTorrent) => ReactNode
  /** Sort key override (defaults to the first rpc field's raw value). */
  sortValue?: (t: CachedTorrent) => number | string
  /** Eligible for the rich view's second line. */
  rich: boolean
  /** Shown by default in compact view. */
  defaultVisible: boolean
}

function rawSort(field: FieldDef) {
  return (t: CachedTorrent): number | string => {
    const value = (t as unknown as Record<string, unknown>)[field.rpcFields[0]]
    if (typeof value === "number") return value
    return String(value ?? "")
  }
}

const statusText = (t: CachedTorrent) => {
  const base = StatusStrings[t.status] ?? "Unknown"
  return t.status === Status.downloading && t.sequential_download === true
    ? `${base} sequentially`
    : base
}

const rateText =
  (key: "rateDownload" | "rateUpload") =>
  (t: CachedTorrent): string => {
    const v = t[key]
    return v > 0 ? formatSpeed(v) : ""
  }

const ratioText = (t: CachedTorrent) => {
  if (t.uploadRatio < 0) return ""
  if (t.uploadedEver === 0) return "0.00"
  if (t.downloadedEver === 0) return "∞"
  return t.uploadRatio.toFixed(2)
}

const seedsText = (t: CachedTorrent) =>
  t.cachedSeedsTotal < 0 ? `${t.peersSendingToUs}` : `${t.peersSendingToUs} / ${t.cachedSeedsTotal}`

const peersText = (t: CachedTorrent) =>
  t.cachedPeersTotal < 0 ? `${t.peersGettingFromUs}` : `${t.peersGettingFromUs} / ${t.cachedPeersTotal}`

const priorityClasses: Record<PriorityNumberType, string> = {
  [-1]: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  0: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  1: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
}

function textCell(t: CachedTorrent, field: FieldDef): ReactNode {
  const value = field.text(t)
  return <span className="block truncate">{value}</span>
}

function nameCell(t: CachedTorrent): ReactNode {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <StatusIcon torrent={t} className="size-4 shrink-0" />
      <span className="truncate" title={t.name}>
        {t.name}
      </span>
    </span>
  )
}

function progressCell(t: CachedTorrent): ReactNode {
  const percent = Math.max(0, Math.min(1, t.percentDone)) * 100
  return (
    <span className="flex items-center gap-2">
      <ProgressBar className="h-2 flex-1" percent={percent} variant={progressVariant(t)} />
      <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {formatPercent(t.percentDone)}
      </span>
    </span>
  )
}

function metadataCell(t: CachedTorrent): ReactNode {
  const percent = Math.max(0, Math.min(1, t.metadataPercentComplete)) * 100
  return <ProgressBar className="h-2 w-full" percent={percent} variant="default" />
}

function labelsCell(t: CachedTorrent): ReactNode {
  if (t.labels.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex min-w-0 gap-1 overflow-hidden">
      {t.labels.map((label) => (
        <Badge key={label} variant="secondary" className="max-w-28 shrink truncate rounded-md px-1.5 text-xs font-normal">
          {label}
        </Badge>
      ))}
    </span>
  )
}

function priorityCell(t: CachedTorrent): ReactNode {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs ${priorityClasses[t.bandwidthPriority] ?? priorityClasses[0]}`}
    >
      {PriorityStrings[t.bandwidthPriority] ?? "Normal"}
    </span>
  )
}

function errorCell(t: CachedTorrent): ReactNode {
  if (t.cachedError === "") return <span className="text-muted-foreground">—</span>
  return (
    <span className="block truncate text-destructive" title={t.cachedError}>
      {t.cachedError}
    </span>
  )
}

// prettier-ignore
export const allFields: FieldDef[] = [
  {
    id: "name", label: "Name", rpcFields: ["name"], width: 260, align: "left", rich: false,
    defaultVisible: true, text: (t) => t.name, cell: nameCell,
  },
  {
    id: "progress", label: "Done", rpcFields: ["percentDone", "rateDownload", "rateUpload"], width: 170,
    align: "left", rich: false, defaultVisible: true, text: (t) => formatPercent(t.percentDone),
    cell: progressCell, sortValue: (t) => t.percentDone,
  },
  {
    id: "status", label: "Status", rpcFields: ["status", "sequential_download"], width: 130, align: "left",
    rich: true, defaultVisible: true, text: statusText, sortValue: (t) => t.status,
  },
  {
    id: "rateDownload", label: "Down speed", rpcFields: ["rateDownload"], width: 100, align: "right",
    rich: true, defaultVisible: true, text: rateText("rateDownload"),
    richText: (t) => { const v = rateText("rateDownload")(t); return v === "" ? "" : `↓ ${v}` },
  },
  {
    id: "rateUpload", label: "Up speed", rpcFields: ["rateUpload"], width: 100, align: "right",
    rich: true, defaultVisible: true, text: rateText("rateUpload"),
    richText: (t) => { const v = rateText("rateUpload")(t); return v === "" ? "" : `↑ ${v}` },
  },
  {
    id: "eta", label: "ETA", rpcFields: ["eta"], width: 90, align: "right", rich: true, defaultVisible: true,
    text: (t) => formatEta(t.eta),
  },
  {
    id: "totalSize", label: "Size", rpcFields: ["totalSize"], width: 96, align: "right", rich: true,
    defaultVisible: true, text: (t) => formatBytes(t.totalSize),
  },
  {
    id: "uploadRatio", label: "Ratio", rpcFields: ["uploadRatio", "uploadedEver", "downloadedEver"], width: 76,
    align: "right", rich: true, defaultVisible: true, text: ratioText, sortValue: (t) => t.uploadRatio,
  },
  {
    id: "seeds", label: "Seeds", rpcFields: ["peersSendingToUs", "trackerStats"], width: 84, align: "right",
    rich: true, defaultVisible: true, text: seedsText, sortValue: (t) => t.cachedSeedsTotal * 1e6 + t.peersSendingToUs,
  },
  {
    id: "peers", label: "Peers", rpcFields: ["peersGettingFromUs", "trackerStats"], width: 84, align: "right",
    rich: true, defaultVisible: true, text: peersText, sortValue: (t) => t.cachedPeersTotal * 1e6 + t.peersGettingFromUs,
  },
  {
    id: "labels", label: "Labels", rpcFields: ["labels"], width: 150, align: "left", rich: true,
    defaultVisible: true, text: (t) => t.labels.join(", "), cell: labelsCell,
  },
  {
    id: "tracker", label: "Tracker", rpcFields: ["trackerStats"], width: 160, align: "left", rich: true,
    defaultVisible: true, text: (t) => t.cachedMainTracker, sortValue: (t) => t.cachedMainTracker,
  },
  {
    id: "addedDate", label: "Added on", rpcFields: ["addedDate"], width: 150, align: "left", rich: true,
    defaultVisible: false, text: (t) => formatDate(t.addedDate),
  },
  {
    id: "doneDate", label: "Completed on", rpcFields: ["doneDate"], width: 150, align: "left", rich: true,
    defaultVisible: false, text: (t) => formatDate(t.doneDate),
  },
  {
    id: "activityDate", label: "Last active", rpcFields: ["activityDate"], width: 110, align: "right", rich: true,
    defaultVisible: false, text: (t) => formatDateDiff(t.activityDate), sortValue: (t) => t.activityDate,
  },
  {
    id: "downloadDir", label: "Path", rpcFields: ["downloadDir"], width: 200, align: "left", rich: true,
    defaultVisible: false, text: (t) => t.downloadDir,
  },
  {
    id: "queuePosition", label: "Queue", rpcFields: ["queuePosition"], width: 70, align: "right", rich: true,
    defaultVisible: false, text: (t) => (t.queuePosition > 0 ? String(t.queuePosition) : ""),
  },
  {
    id: "id", label: "ID", rpcFields: ["id"], width: 64, align: "right", rich: true, defaultVisible: false,
    text: (t) => String(t.id),
  },
  {
    id: "bandwidthPriority", label: "Priority", rpcFields: ["bandwidthPriority"], width: 92, align: "left",
    rich: true, defaultVisible: false, text: (t) => PriorityStrings[t.bandwidthPriority] ?? "Normal",
    cell: priorityCell, sortValue: (t) => t.bandwidthPriority,
  },
  {
    id: "secondsSeeding", label: "Seeding time", rpcFields: ["secondsSeeding"], width: 110, align: "right",
    rich: true, defaultVisible: false, text: (t) => formatDuration(t.secondsSeeding),
  },
  {
    id: "isPrivate", label: "Private", rpcFields: ["isPrivate"], width: 76, align: "center", rich: true,
    defaultVisible: false, text: (t) => (t.isPrivate ? "Yes" : "No"),
  },
  {
    id: "fileCount", label: "Files", rpcFields: ["file-count"], width: 70, align: "right", rich: true,
    defaultVisible: false, text: (t) => String(t["file-count"]),
  },
  {
    id: "pieceCount", label: "Pieces", rpcFields: ["pieceCount"], width: 80, align: "right", rich: true,
    defaultVisible: false, text: (t) => String(t.pieceCount),
  },
  {
    id: "pieceSize", label: "Piece size", rpcFields: ["pieceSize"], width: 96, align: "right", rich: true,
    defaultVisible: false, text: (t) => formatBytes(t.pieceSize),
  },
  {
    id: "metadataPercentComplete", label: "Metadata", rpcFields: ["metadataPercentComplete"], width: 120,
    align: "left", rich: false, defaultVisible: false, text: (t) => formatPercent(t.metadataPercentComplete),
    cell: metadataCell, sortValue: (t) => t.metadataPercentComplete,
  },
  {
    id: "sizeWhenDone", label: "To download", rpcFields: ["sizeWhenDone"], width: 100, align: "right",
    rich: true, defaultVisible: false, text: (t) => formatBytes(t.sizeWhenDone),
  },
  {
    id: "leftUntilDone", label: "Size left", rpcFields: ["leftUntilDone"], width: 100, align: "right",
    rich: true, defaultVisible: false, text: (t) => formatBytes(t.leftUntilDone),
  },
  {
    id: "downloadedEver", label: "Downloaded", rpcFields: ["downloadedEver"], width: 100, align: "right",
    rich: true, defaultVisible: false, text: (t) => formatBytes(t.downloadedEver),
  },
  {
    id: "uploadedEver", label: "Uploaded", rpcFields: ["uploadedEver"], width: 100, align: "right",
    rich: true, defaultVisible: false, text: (t) => formatBytes(t.uploadedEver),
  },
  {
    id: "haveValid", label: "Have", rpcFields: ["haveValid"], width: 96, align: "right", rich: true,
    defaultVisible: false, text: (t) => formatBytes(t.haveValid),
  },
  {
    id: "group", label: "Group", rpcFields: ["group"], width: 110, align: "left", rich: true,
    defaultVisible: false, text: (t) => t.group,
  },
  {
    id: "error", label: "Error", rpcFields: ["error", "errorString", "trackerStats"], width: 200, align: "left",
    rich: true, defaultVisible: false, text: (t) => t.cachedError, cell: errorCell,
    sortValue: (t) => t.cachedError,
  },
  {
    id: "trackerStatus", label: "Tracker status", rpcFields: ["trackerStats"], width: 170, align: "left",
    rich: true, defaultVisible: false, text: (t) => t.cachedTrackerStatus,
    sortValue: (t) => t.cachedTrackerStatus,
  },
  {
    id: "hashString", label: "Hash", rpcFields: ["hashString"], width: 260, align: "left", rich: true,
    defaultVisible: false, text: (t) => t.hashString,
  },
]

for (const field of allFields) {
  if (field.sortValue === undefined) field.sortValue = rawSort(field)
}

export const fieldsById: Record<string, FieldDef> = Object.fromEntries(
  allFields.map((f) => [f.id, f]),
)

export const defaultCompactOrder: string[] = allFields
  .filter((f) => f.defaultVisible)
  .map((f) => f.id)

export const defaultRichOrder: string[] = allFields
  .filter((f) => f.rich && f.defaultVisible)
  .map((f) => f.id)

/** RPC fields needed for the given visible field sets (plus filters/search). */
export function requiredTorrentFields(
  compactOrder: string[],
  richOrder: string[],
  rich: boolean,
): string[] {
  const set = new Set<string>()
  const add = (id: string) => {
    const field = fieldsById[id]
    if (field) field.rpcFields.forEach((f) => set.add(f))
  }

  // Visible view's fields cover rendering and sort keys.
  const visible = rich ? richOrder : compactOrder
  visible.forEach(add)

  // Minimum set: filters (status/labels/paths/tracker), search, magnets, rows,
  // plus everything the details panel renders (it is always available).
  ;[
    "id", "name", "status", "pieceCount", "downloadDir", "labels", "error", "errorString",
    "trackerStats", "magnetLink", "rateDownload", "rateUpload", "sizeWhenDone", "haveValid",
    "percentDone", "leftUntilDone",
    // details panel
    "bandwidthPriority", "queuePosition", "eta", "leftUntilDone", "downloadedEver",
    "uploadedEver", "uploadRatio", "peersSendingToUs", "peersGettingFromUs", "peersConnected",
    "secondsSeeding", "secondsDownloading", "corruptEver", "dateCreated", "creator", "comment",
    "downloadLimited", "downloadLimit", "uploadLimited", "uploadLimit", "maxConnectedPeers",
    "isPrivate", "file-count", "pieceSize", "addedDate", "doneDate", "activityDate",
    "group", "hashString",
  ].forEach((f) => set.add(f))

  return Array.from(set).sort()
}

export function compareFields(a: CachedTorrent, b: CachedTorrent, field: FieldDef, desc: boolean): number {
  const get = field.sortValue ?? rawSort(field)
  const va = get(a)
  const vb = get(b)
  let result: number
  if (typeof va === "number" && typeof vb === "number") result = va - vb
  else result = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" })
  return desc ? -result : result
}

export { textCell }
