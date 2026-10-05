import { useState } from "react"
import { PanelLeftClose } from "lucide-react"
import { useSession, useSessionStats } from "@/hooks/use-session"
import type { SpeedPoint } from "@/hooks/use-speed-history"
import { ThemeToggle } from "@/components/theme-toggle"
import { SpeedChart } from "@/components/layout/speed-chart"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatBytes, formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

interface SidebarProps {
  points: SpeedPoint[]
  /** Collapse the sidebar (desktop only; hidden once collapsed). */
  onCollapse?: () => void
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div
        className="min-w-0 text-right font-medium tabular-nums"
        title={typeof value === "string" ? value : undefined}
      >
        {typeof value === "string" ? <span className="block truncate">{value}</span> : value}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  mark,
  markClass,
}: {
  label: string
  value: string
  mark?: string
  markClass?: string
}) {
  return (
    <div className="border-b px-0.5 py-0.5">
      <div className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {mark !== undefined && <span className={cn("text-xs leading-none", markClass)}>{mark}</span>}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground" title={value}>
        {value}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-xs font-medium text-muted-foreground">{children}</div>
  )
}

export function Sidebar({ points, onCollapse }: SidebarProps) {
  const [graphOpen, setGraphOpen] = useState(false)
  const session = useSession().data
  const stats = useSessionStats().data

  const last = points.at(-1)

  return (
    <aside className="flex h-full w-full flex-col gap-5 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-lg leading-6 font-semibold tracking-[0.04em] text-foreground">
            transmix
          </span>
          <span className="w-fit rounded-[3px] bg-primary px-1.5 font-mono text-[9px] leading-[1.2] font-medium text-primary-foreground">
            {__APP_VERSION__}
          </span>
        </div>
        <div className="flex items-center">
          {onCollapse !== undefined && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onCollapse}
              aria-label="Hide sidebar"
              title="Hide sidebar"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">Transfer</span>
          {last !== undefined && (
            <button
              type="button"
              onClick={() => setGraphOpen(true)}
              className="-mr-1 flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 tabular-nums transition-colors hover:bg-accent"
              aria-label="Expand speed graph"
              title="Expand speed graph"
            >
              <span className="text-sky-500">↓ {formatBytes(last.down)}/s</span>
              <span className="text-emerald-500">↑ {formatBytes(last.up)}/s</span>
            </button>
          )}
        </div>
        <SpeedChart points={points} height={84} />
      </div>

      <div>
        <SectionTitle>Server statistics</SectionTitle>
        {stats === undefined ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              <StatCard
                label="Downloaded"
                value={formatBytes(stats["cumulative-stats"].downloadedBytes)}
                mark="↓"
                markClass="text-sky-500"
              />
              <StatCard
                label="Uploaded"
                value={formatBytes(stats["cumulative-stats"].uploadedBytes)}
                mark="↑"
                markClass="text-emerald-500"
              />
              <StatCard
                label="Ratio"
                value={
                  stats["cumulative-stats"].downloadedBytes === 0
                    ? "∞"
                    : (stats["cumulative-stats"].uploadedBytes / stats["cumulative-stats"].downloadedBytes).toFixed(2)
                }
              />
              <StatCard
                label="Free space"
                value={
                  session?.["download-dir-free-space"] !== undefined
                    ? formatBytes(session["download-dir-free-space"])
                    : "—"
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {stats.activeTorrentCount} active
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                {stats.pausedTorrentCount} paused
              </span>
              <span className="tabular-nums">{stats.torrentCount} total</span>
            </div>

            <StatRow
              label="This session"
              value={
                <>
                  <span className="block">
                    <span className="text-sky-500">↓</span> {formatBytes(stats["current-stats"].downloadedBytes)}{" "}
                    <span className="text-emerald-500">↑</span> {formatBytes(stats["current-stats"].uploadedBytes)}
                  </span>
                  <span className="block font-normal text-muted-foreground">
                    {formatDuration(stats["current-stats"].secondsActive) || "0s"}
                  </span>
                </>
              }
            />

            <div className="space-y-1">
              <StatRow label="Uptime" value={formatDuration(stats["cumulative-stats"].secondsActive) || "0s"} />
              <StatRow label="Files added" value={String(stats["cumulative-stats"].filesAdded)} />
              {stats["cumulative-stats"].sessionCount > 1 && (
                <StatRow label="Session count" value={String(stats["cumulative-stats"].sessionCount)} />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              session !== undefined ? "bg-emerald-500" : "animate-pulse bg-muted-foreground/50",
            )}
          />
          {session?.version ?? "…"}
        </span>
        <div className="flex items-center">
          <ThemeToggle className="size-8" />
        </div>
      </div>

      <Dialog open={graphOpen} onOpenChange={setGraphOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transfer speeds</DialogTitle>
            <DialogDescription>
              Rolling window sampled from torrent activity (about the last 2 minutes).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 pb-1 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sky-500" />
              Download
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Upload
            </span>
            {last !== undefined && (
              <span className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap tabular-nums text-muted-foreground">
                <span className="whitespace-nowrap text-sky-500">↓ {formatBytes(last.down)}/s</span>
                <span className="whitespace-nowrap text-emerald-500">↑ {formatBytes(last.up)}/s</span>
              </span>
            )}
          </div>
          <SpeedChart points={points} height={260} showAxis />
        </DialogContent>
      </Dialog>
    </aside>
  )
}
