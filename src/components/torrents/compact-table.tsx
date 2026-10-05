import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDown, ArrowUp } from "lucide-react"
import { useMemo, useRef } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { fieldsById, type FieldDef } from "@/components/torrents/fields"
import type { CachedTorrent } from "@/lib/torrents"
import { cn } from "@/lib/utils"

export interface SortState {
  id: string
  desc: boolean
}

export interface TableSelectionProps {
  selected: Set<number>
  current: number | null
  onRowClick: (id: number, event: React.MouseEvent, orderedIds: number[]) => void
  onCheckboxToggle: (id: number) => void
  onSelectAll: (orderedIds: number[]) => void
  onSelectNone: () => void
  onRowDoubleClick?: (id: number) => void
}

interface CompactTableProps {
  data: CachedTorrent[]
  order: string[]
  widths: Record<string, number>
  onResize: (id: string, width: number) => void
  sort: SortState | null
  onSortChange: (id: string) => void
  selection: TableSelectionProps
}

const ROW_HEIGHT = 36
const CHECKBOX_WIDTH = 40

function alignClasses(field: FieldDef): string {
  if (field.align === "right") return "text-right"
  if (field.align === "center") return "text-center"
  return "text-left"
}

export function CompactTable({
  data,
  order,
  widths,
  onResize,
  sort,
  onSortChange,
  selection,
}: CompactTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { selected, current, onRowClick, onCheckboxToggle, onSelectAll, onSelectNone, onRowDoubleClick } = selection

  const columns = useMemo(
    () => order.map((id) => fieldsById[id]).filter((f): f is FieldDef => f !== undefined),
    [order],
  )
  const orderedIds = useMemo(() => data.map((t) => t.id), [data])
  const widthOf = (field: FieldDef) => widths[field.id] ?? field.width
  const totalWidth = CHECKBOX_WIDTH + columns.reduce((sum, col) => sum + widthOf(col), 0)

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })
  const virtualRows = virtualizer.getVirtualItems()

  const allSelected = data.length > 0 && data.every((t) => selected.has(t.id))
  const someSelected = data.some((t) => selected.has(t.id))

  const startResize = (event: React.MouseEvent, field: FieldDef) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = widthOf(field)
    const onMove = (e: MouseEvent) => {
      onResize(field.id, Math.max(48, startWidth + e.clientX - startX))
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <div style={{ width: totalWidth }}>
        <div
          className="sticky top-0 z-10 flex h-9 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          style={{ width: totalWidth }}
        >
          <div className="flex h-full w-10 shrink-0 items-center justify-center border-r">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => {
                if (checked === false) onSelectNone()
                else onSelectAll(orderedIds)
              }}
              aria-label="Select all"
            />
          </div>
          {columns.map((col) => {
            const active = sort?.id === col.id
            return (
              <div
                key={col.id}
                className="group/header relative flex h-full shrink-0 items-stretch border-r last:border-r-0"
                style={{ width: widthOf(col) }}
              >
                <button
                  type="button"
                  onClick={() => onSortChange(col.id)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1 px-2 text-xs font-medium",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="truncate">{col.label}</span>
                  {active &&
                    (sort.desc ? (
                      <ArrowDown className="size-3 shrink-0" />
                    ) : (
                      <ArrowUp className="size-3 shrink-0" />
                    ))}
                </button>
                <div
                  className="absolute -right-0.5 top-0 h-full w-1.5 cursor-col-resize opacity-0 transition-opacity hover:bg-primary/40 group-hover/header:opacity-100"
                  onMouseDown={(e) => startResize(e, col)}
                  onDoubleClick={() => onResize(col.id, col.width)}
                  aria-hidden
                />
              </div>
            )
          })}
        </div>

        {data.length === 0 ? (
          <div
            className="flex h-40 items-center justify-center text-sm text-muted-foreground"
            style={{ width: Math.max(totalWidth, 0) }}
          >
            No torrents match the current filters.
          </div>
        ) : (
          <div className="relative" style={{ height: virtualizer.getTotalSize(), width: totalWidth }}>
            {virtualRows.map((virtualRow) => {
              const t = data[virtualRow.index]
              if (t === undefined) return null
              const isSelected = selected.has(t.id)
              const isCurrent = current === t.id
              return (
                <div
                  key={t.id}
                  className={cn(
                    "absolute left-0 flex cursor-default select-none items-center",
                    isSelected
                      ? "bg-accent"
                      : isCurrent
                        ? "bg-accent/40"
                        : "hover:bg-accent/40",
                    !isSelected && t.error !== 0 && "bg-red-500/5",
                  )}
                  style={{ transform: `translateY(${virtualRow.start}px)`, height: ROW_HEIGHT, width: totalWidth }}
                  onClick={(e) => onRowClick(t.id, e, orderedIds)}
                  onContextMenu={(e) => onRowClick(t.id, e, orderedIds)}
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, [role=checkbox]") !== null) return
                    onRowDoubleClick?.(t.id)
                  }}
                >
                  <div className="flex h-full w-10 shrink-0 items-center justify-center">
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => onCheckboxToggle(t.id)}
                      aria-label={`Select ${t.name}`}
                    />
                  </div>
                  {columns.map((col) => (
                    <div
                      key={col.id}
                      className={cn(
                        "flex h-full min-w-0 shrink-0 items-center overflow-hidden px-2 text-sm",
                        alignClasses(col),
                      )}
                      style={{ width: widthOf(col) }}
                    >
                      <div className="min-w-0 flex-1">
                        {col.cell ? col.cell(t) : <span className="block truncate">{col.text(t)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
