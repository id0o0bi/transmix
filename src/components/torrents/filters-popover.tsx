import { useMemo } from "react"
import { Check, Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  activeFilterCount,
  defaultFilterState,
  noLabelsFilterId,
  statusFilters,
  type CachedTorrent,
  type TorrentFilterState,
} from "@/lib/torrents"
import { cn } from "@/lib/utils"

interface FiltersPopoverProps {
  torrents: CachedTorrent[]
  filter: TorrentFilterState
  onFilterChange: (next: TorrentFilterState) => void
}

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

interface CountItem {
  id: string
  label: string
  count: number
}

function Section(props: {
  title: string
  count: number
  onClear: () => void
  children: React.ReactNode
}) {
  if (props.count === 0) return null
  return (
    <div className="py-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {props.title}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={props.onClear}
        >
          Clear
        </Button>
      </div>
      {props.children}
    </div>
  )
}

function Item(props: {
  label: string
  count: number
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={props.checked}
      onClick={props.onToggle}
      className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent"
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm border",
          props.checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-background",
        )}
      >
        {props.checked && <Check className="size-3" />}
      </span>
      <span className="min-w-0 flex-1 truncate" title={props.label}>
        {props.label}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{props.count}</span>
    </button>
  )
}

export function FiltersPopover({ torrents, filter, onFilterChange }: FiltersPopoverProps) {
  const activeCount = activeFilterCount(filter)

  const statusCounts = useMemo<CountItem[]>(() => {
    return statusFilters
      .filter((def) => def.id !== "all")
      .map((def) => ({
        id: def.id,
        label: def.label,
        count: torrents.filter(def.filter).length,
      }))
  }, [torrents])

  const labelCounts = useMemo<CountItem[]>(() => {
    const map = new Map<string, number>()
    let unlabeled = 0
    for (const t of torrents) {
      if (t.labels.length === 0) unlabeled++
      for (const label of t.labels) map.set(label, (map.get(label) ?? 0) + 1)
    }
    const items: CountItem[] = [...map.entries()]
      .map(([label, count]) => ({ id: label, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label))
    if (unlabeled > 0) {
      items.unshift({ id: noLabelsFilterId, label: "No labels", count: unlabeled })
    }
    return items
  }, [torrents])

  const trackerCounts = useMemo<CountItem[]>(() => {
    const map = new Map<string, number>()
    for (const t of torrents) {
      map.set(t.cachedMainTracker, (map.get(t.cachedMainTracker) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([host, count]) => ({ id: host, label: host, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [torrents])

  const dirCounts = useMemo<CountItem[]>(() => {
    const map = new Map<string, number>()
    for (const t of torrents) map.set(t.downloadDir, (map.get(t.downloadDir) ?? 0) + 1)
    return [...map.entries()]
      .map(([dir, count]) => ({ id: dir, label: dir, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [torrents])

  const setStatus = (id: string) => {
    if (id === "all") {
      onFilterChange({ ...filter, status: new Set(["all"]) })
      return
    }
    let next = toggle(filter.status, id)
    next.delete("all")
    if (next.size === 0) next = new Set(["all"])
    onFilterChange({ ...filter, status: next })
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9 sm:size-8"
              aria-label="Filters"
            >
              <Filter className="size-4" />
              {activeCount > 0 && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {`Filters${activeCount > 0 ? ` (${activeCount} active)` : ""}`}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-1rem)] p-2">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-sm font-semibold">Filters</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => onFilterChange(defaultFilterState())}
            disabled={activeCount === 0}
          >
            <X className="mr-1 size-3" />
            Reset all
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto pe-1">
          <Section
            title="Status"
            count={statusCounts.length}
            onClear={() => onFilterChange({ ...filter, status: new Set(["all"]) })}
          >
            <Item
              label="All torrents"
              count={torrents.length}
              checked={filter.status.has("all")}
              onToggle={() => setStatus("all")}
            />
            {statusCounts.map((item) => (
              <Item
                key={item.id}
                label={item.label}
                count={item.count}
                checked={filter.status.has(item.id)}
                onToggle={() => setStatus(item.id)}
              />
            ))}
          </Section>

          <Separator className="my-1" />

          <Section
            title="Labels"
            count={labelCounts.length}
            onClear={() => onFilterChange({ ...filter, labels: new Set() })}
          >
            {labelCounts.map((item) => (
              <Item
                key={item.id}
                label={item.label}
                count={item.count}
                checked={filter.labels.has(item.id)}
                onToggle={() => onFilterChange({ ...filter, labels: toggle(filter.labels, item.id) })}
              />
            ))}
          </Section>

          <Separator className="my-1" />

          <Section
            title="Trackers"
            count={trackerCounts.length}
            onClear={() => onFilterChange({ ...filter, trackers: new Set() })}
          >
            {trackerCounts.map((item) => (
              <Item
                key={item.id}
                label={item.label}
                count={item.count}
                checked={filter.trackers.has(item.id)}
                onToggle={() =>
                  onFilterChange({ ...filter, trackers: toggle(filter.trackers, item.id) })
                }
              />
            ))}
          </Section>

          <Separator className="my-1" />

          <Section
            title="Paths"
            count={dirCounts.length}
            onClear={() => onFilterChange({ ...filter, dirs: new Set() })}
          >
            {dirCounts.map((item) => (
              <Item
                key={item.id}
                label={item.label}
                count={item.count}
                checked={filter.dirs.has(item.id)}
                onToggle={() => onFilterChange({ ...filter, dirs: toggle(filter.dirs, item.id) })}
              />
            ))}
          </Section>
        </div>

        {activeCount > 0 && (
          <div className="mt-1 flex items-center gap-1 border-t pt-1.5 text-xs text-muted-foreground">
            <Check className="size-3" />
            {activeCount} active {activeCount === 1 ? "filter" : "filters"}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
