import { useMemo } from "react"
import { ChevronDown, ChevronUp, Columns3, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { allFields, defaultCompactOrder, defaultRichOrder, type FieldDef } from "@/components/torrents/fields"
import { cn } from "@/lib/utils"

export type ViewMode = "compact" | "rich"

interface ColumnsPopoverProps {
  mode: ViewMode
  compactOrder: string[]
  richOrder: string[]
  onOrderChange: (mode: ViewMode, order: string[]) => void
}

function Row(props: {
  field: FieldDef
  checked: boolean
  showMove: boolean
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const { field, checked, showMove } = props
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-sm px-1.5 py-1 hover:bg-accent",
        showMove && checked && "bg-accent/50",
      )}
    >
      <Checkbox checked={checked} onCheckedChange={props.onToggle} id={`col-${field.id}`} />
      <label
        htmlFor={`col-${field.id}`}
        className="min-w-0 flex-1 cursor-pointer truncate text-sm"
        title={field.label}
      >
        {field.label}
      </label>
      {showMove && checked && (
        <span className="flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-5"
            disabled={props.isFirst}
            onClick={() => props.onMove(-1)}
            aria-label={`Move ${field.label} up`}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-5"
            disabled={props.isLast}
            onClick={() => props.onMove(1)}
            aria-label={`Move ${field.label} down`}
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </span>
      )}
    </div>
  )
}

export function ColumnsPopover({ mode, compactOrder, richOrder, onOrderChange }: ColumnsPopoverProps) {
  const order = mode === "compact" ? compactOrder : richOrder
  const registry = useMemo(
    () => allFields.filter((f) => (mode === "rich" ? f.rich : true)),
    [mode],
  )
  const visible = registry.filter((f) => order.includes(f.id))
  const hidden = registry.filter((f) => !order.includes(f.id))

  const move = (index: number, dir: -1 | 1) => {
    const next = [...order]
    const target = index + dir
    const a = next[index]
    const b = next[target]
    if (a === undefined || b === undefined) return
    next[index] = b
    next[target] = a
    onOrderChange(mode, next)
  }

  const toggle = (id: string) => {
    if (order.includes(id)) {
      onOrderChange(mode, order.filter((x) => x !== id))
    } else {
      const registryOrder = registry.map((f) => f.id)
      // Append in registry order so new fields land in a stable position.
      const next = [...order, ...registryOrder.filter((x) => x === id && !order.includes(x))]
      onOrderChange(mode, next)
    }
  }

  const reset = () => onOrderChange(mode, mode === "compact" ? [...defaultCompactOrder] : [...defaultRichOrder])

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 sm:size-8"
              aria-label="Customize columns"
            >
              <Columns3 className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{mode === "compact" ? "Columns" : "Fields"}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 max-w-[calc(100vw-1rem)] p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {mode === "compact" ? "Compact columns" : "Rich fields"}
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={reset}>
            <RotateCcw className="mr-1 size-3" />
            Reset
          </Button>
        </div>

        <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Visible ({visible.length})
        </div>
        <div className="max-h-44 overflow-y-auto pe-1">
          {visible.length === 0 && (
            <p className="px-1.5 py-2 text-sm text-muted-foreground">No columns shown.</p>
          )}
          {visible.map((field, index) => (
            <Row
              key={field.id}
              field={field}
              checked
              showMove
              isFirst={index === 0}
              isLast={index === visible.length - 1}
              onToggle={() => toggle(field.id)}
              onMove={(dir) => move(index, dir)}
            />
          ))}
        </div>

        <div className="mb-1 mt-2 border-t pt-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hidden ({hidden.length})
        </div>
        <div className="max-h-36 overflow-y-auto pe-1">
          {hidden.length === 0 && (
            <p className="px-1.5 py-2 text-sm text-muted-foreground">All columns are shown.</p>
          )}
          {hidden.map((field) => (
            <Row
              key={field.id}
              field={field}
              checked={false}
              showMove={false}
              isFirst={false}
              isLast={false}
              onToggle={() => toggle(field.id)}
              onMove={() => {}}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
