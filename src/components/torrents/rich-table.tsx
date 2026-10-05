import { useVirtualizer } from "@tanstack/react-virtual"
import { useMemo, useRef } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { ProgressBar } from "@/components/torrents/progress-bar"
import { StatusIcon } from "@/components/torrents/status-icon"
import { fieldsById, type FieldDef } from "@/components/torrents/fields"
import { formatPercent } from "@/lib/format"
import { progressVariant, type CachedTorrent } from "@/lib/torrents"
import { cn } from "@/lib/utils"
import type { TableSelectionProps } from "@/components/torrents/compact-table"

interface RichTableProps {
  data: CachedTorrent[]
  /** Rich view's second-line field ids, in order. */
  order: string[]
  selection: TableSelectionProps
}

const ROW_HEIGHT = 62

interface VisibleChip {
  fieldId: string
  value: string
  separator: boolean
}

function visibleChips(t: CachedTorrent, chips: FieldDef[]): VisibleChip[] {
  const out: VisibleChip[] = []
  for (const field of chips) {
    if (field.text(t) === "") continue
    const value = field.richText
      ? field.richText(t)
      : field.id === "name"
        ? ""
        : `${field.label}: ${field.text(t)}`
    if (value === "") continue
    out.push({ fieldId: field.id, value, separator: out.length > 0 })
  }
  return out
}

export function RichTable({ data, order, selection }: RichTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { selected, current, onRowClick, onCheckboxToggle, onSelectAll, onSelectNone, onRowDoubleClick } = selection

  const chips = useMemo(
    () => order.map((id) => fieldsById[id]).filter((f): f is FieldDef => f !== undefined),
    [order],
  )
  const orderedIds = useMemo(() => data.map((t) => t.id), [data])

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })
  const virtualRows = virtualizer.getVirtualItems()

  const allSelected = data.length > 0 && data.every((t) => selected.has(t.id))
  const someSelected = data.some((t) => selected.has(t.id))

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={(checked) => {
            if (checked === false) onSelectNone()
            else onSelectAll(orderedIds)
          }}
          aria-label="Select all"
        />
        <span className="text-xs font-medium text-muted-foreground">
          {data.length} {data.length === 1 ? "torrent" : "torrents"}
        </span>
      </div>

      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          No torrents match the current filters.
        </div>
      ) : (
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualRows.map((virtualRow) => {
            const t = data[virtualRow.index]
            if (t === undefined) return null
            const isSelected = selected.has(t.id)
            const isCurrent = current === t.id
            const percent = Math.max(0, Math.min(1, t.percentDone)) * 100
            const rowChips = visibleChips(t, chips)

            return (
              <div
                key={t.id}
                className={cn(
                  "absolute inset-x-0 cursor-default select-none border-b border-transparent",
                  isSelected ? "bg-accent" : isCurrent ? "bg-accent/40" : "hover:bg-accent/40",
                  !isSelected && t.error !== 0 && "bg-red-500/5",
                )}
                style={{ transform: `translateY(${virtualRow.start}px)`, height: ROW_HEIGHT }}
                onClick={(e) => onRowClick(t.id, e, orderedIds)}
                onContextMenu={(e) => onRowClick(t.id, e, orderedIds)}
                onDoubleClick={(e) => {
                  if ((e.target as HTMLElement).closest("button, [role=checkbox]") !== null) return
                  onRowDoubleClick?.(t.id)
                }}
              >
                <div className="flex h-9 items-center gap-2 px-2">
                  <Checkbox
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => onCheckboxToggle(t.id)}
                    aria-label={`Select ${t.name}`}
                  />
                  <StatusIcon torrent={t} className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium" title={t.name}>
                    {t.name}
                  </span>
                  <ProgressBar
                    className="hidden h-2 w-32 sm:block lg:w-44"
                    percent={percent}
                    variant={progressVariant(t)}
                  />
                  <span className="hidden w-11 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                    {formatPercent(t.percentDone)}
                  </span>
                </div>
                {rowChips.length > 0 && (
                  <div className="flex h-5 items-center gap-2 overflow-hidden px-8 text-xs text-muted-foreground">
                    {rowChips.map((chip) => (
                      <span key={chip.fieldId} className="flex shrink-0 items-center gap-2">
                        {chip.separator && <span className="opacity-40">·</span>}
                        <span className="whitespace-nowrap" title={chip.value}>
                          {chip.value}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
