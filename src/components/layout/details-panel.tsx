import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileList } from "@/components/torrents/file-list"
import { PeerList } from "@/components/torrents/peer-list"
import { PieceView } from "@/components/torrents/piece-view"
import { TrackerList } from "@/components/torrents/tracker-list"
import {
  PriorityStrings,
  StatusStrings,
  trackerNextUpdateText,
} from "@/lib/transmission"
import { formatBytes, formatDate, formatDateDiff, formatDuration, formatEta, formatSpeed } from "@/lib/format"
import type { CachedTorrent } from "@/lib/torrents"

interface DetailsPanelProps {
  torrent: CachedTorrent | null
  onClose: () => void
  /** Active details tab, controlled by the layout so menu actions can jump to it. */
  tab: string
  onTabChange: (value: string) => void
}

function Field({ label, value, title }: { label: string; value: ReactNode; title?: string }) {
  if (value === "") return null
  return (
    <div className="min-w-0">
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
      <div className="truncate text-sm leading-snug font-medium" title={title ?? (typeof value === "string" ? value : undefined)}>
        {value}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-full pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

export function DetailsPanel({ torrent: t, onClose, tab, onTabChange }: DetailsPanelProps) {
  if (t === null) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
        Select a torrent to see its details
      </div>
    )
  }

  const seeds =
    t.cachedSeedsTotal < 0 ? String(t.peersSendingToUs) : `${t.peersSendingToUs} / ${t.cachedSeedsTotal}`
  const peers =
    t.cachedPeersTotal < 0 ? String(t.peersGettingFromUs) : `${t.peersGettingFromUs} / ${t.cachedPeersTotal}`

  const etaStr = formatEta(t.eta)
  const remaining =
    etaStr !== "" ? `${etaStr} (${formatBytes(t.leftUntilDone)})` : formatBytes(t.leftUntilDone)
  const hashfails = t.pieceSize > 0 ? Math.floor(t.corruptEver / t.pieceSize) : 0
  const avgDown =
    t.secondsDownloading > 0
      ? ` (avg ${formatSpeed(t.downloadedEver / t.secondsDownloading)})`
      : ""
  const doneSize = Math.max(0, t.sizeWhenDone - t.leftUntilDone)
  const seedingTime = formatDuration(t.secondsSeeding)
  const ratioStr =
    t.downloadedEver === 0 && t.uploadedEver > 0
      ? "∞"
      : t.uploadRatio >= 0
        ? t.uploadRatio.toFixed(2)
        : ""
  const shareRatio = ratioStr + (seedingTime !== "" && ratioStr !== "" ? ` (${seedingTime})` : "")
  const speedLimit = (limited: boolean | undefined, limit: number | undefined): string => {
    if (limited !== true) return "-"
    if (limit === undefined || limit < 0) return "∞"
    return formatSpeed(limit * 1024)
  }
  const havePieces =
    t.totalSize > 0 && t.totalSize === t.haveValid
      ? t.pieceCount
      : t.pieceSize > 0
        ? Math.round(t.haveValid / t.pieceSize)
        : 0
  const mainTracker = t.trackerStats[0]
  const nextUpdate = trackerNextUpdateText(mainTracker)
  const fullPath = `${t.downloadDir.replace(/\/+$/, "")}/${t.name}`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs value={tab} defaultValue="info" onValueChange={onTabChange} className="min-h-0 flex-1">
        <div className="flex items-center gap-2 px-3">
          <TabsList variant="line" className="min-w-0 overflow-x-auto pb-2">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="files">Files ({t["file-count"]})</TabsTrigger>
            <TabsTrigger value="pieces">Pieces</TabsTrigger>
            <TabsTrigger value="peers">Peers</TabsTrigger>
            <TabsTrigger value="trackers">Trackers</TabsTrigger>
          </TabsList>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-6 shrink-0"
            onClick={onClose}
            aria-label="Close details"
          >
            <X className="size-4" />
          </Button>
        </div>

        <TabsContent
          value="info"
          className="min-h-0 overflow-y-auto px-3 pt-3 pb-3"
        >
          <div className="grid grid-cols-2 content-start gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <SectionLabel>Transfer</SectionLabel>
            <Field label="Status" value={StatusStrings[t.status] ?? ""} />
            <Field
              label="Remaining"
              value={remaining}
            />
            <Field label="Downloaded" value={formatBytes(t.downloadedEver)} />
            <Field label="Uploaded" value={formatBytes(t.uploadedEver)} />
            <Field
              label="Wasted"
              value={`${formatBytes(t.corruptEver)} (${hashfails} hashfails)`}
            />
            <Field
              label="Download speed"
              title={`${formatSpeed(t.rateDownload)}${avgDown}`}
              value={
                <>
                  <span className="text-sky-500">↓</span> {formatSpeed(t.rateDownload)}
                  {avgDown}
                </>
              }
            />
            <Field
              label="Upload speed"
              value={
                <>
                  <span className="text-emerald-500">↑</span> {formatSpeed(t.rateUpload)}
                </>
              }
            />
            <Field label="Share ratio" value={shareRatio} />
            <Field
              label="Download limit"
              value={speedLimit(t.downloadLimited, t.downloadLimit)}
            />
            <Field
              label="Upload limit"
              value={speedLimit(t.uploadLimited, t.uploadLimit)}
            />
            <Field label="Priority" value={PriorityStrings[t.bandwidthPriority] ?? ""} />
            <Field label="Queue position" value={t.queuePosition > 0 ? String(t.queuePosition) : "—"} />
            <Field label="Bandwidth group" value={t.group} />
            <Field label="Seeds" value={seeds} />
            <Field label="Peers" value={peers} />
            <Field
              label="Max peers"
              value={t.maxConnectedPeers !== undefined ? String(t.maxConnectedPeers) : ""}
            />
            <Field label="Tracker" value={t.cachedMainTracker} />
            <Field
              label="Tracker update on"
              value={t.cachedMainTracker !== "<No trackers>" ? nextUpdate : ""}
            />
            <Field label="Last active" value={formatDateDiff(t.activityDate)} />
            {t.cachedError !== "" && (
              <div className="col-span-full">
                <div className="text-[11px] leading-tight text-destructive">Error</div>
                <div className="truncate text-sm leading-snug font-medium text-destructive" title={t.cachedError}>
                  {t.cachedError}
                </div>
              </div>
            )}

            <SectionLabel>Torrent</SectionLabel>
            <Field label="Full path" value={fullPath} />
            <Field
              label="Created"
              value={
                t.dateCreated > 0
                  ? `${formatDate(t.dateCreated)}${t.creator !== undefined && t.creator !== "" ? ` by ${t.creator}` : ""}`
                  : t.creator ?? ""
              }
            />
            <Field
              label="Total size"
              value={`${formatBytes(t.totalSize)} (${formatBytes(doneSize)} done)`}
            />
            <Field
              label="Pieces"
              value={`${t.pieceCount} × ${formatBytes(t.pieceSize)} (have ${havePieces})`}
            />
            <Field label="Hash" value={t.hashString} />
            <Field label="Comment" value={t.comment ?? ""} />
            <Field label="Added on" value={formatDate(t.addedDate)} />
            <Field label="Completed on" value={t.doneDate > 0 ? formatDate(t.doneDate) : ""} />
            <Field label="Magnet link" value={t.magnetLink} />
            <Field label="Labels" value={t.labels.join(", ")} />
          </div>
        </TabsContent>

        <TabsContent value="files" className="relative min-h-0 overflow-hidden">
          <FileList torrentId={t.id} />
        </TabsContent>

        <TabsContent value="pieces" className="relative min-h-0 overflow-hidden">
          <PieceView torrentId={t.id} />
        </TabsContent>

        <TabsContent value="peers" className="relative min-h-0 overflow-hidden">
          <PeerList torrentId={t.id} />
        </TabsContent>

        <TabsContent value="trackers" className="relative min-h-0 overflow-hidden">
          <TrackerList key={t.id} torrentId={t.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
