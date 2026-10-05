import {
  List,
  ListTree,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Trash2,
  Turtle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { SortState } from "@/components/torrents/compact-table"
import type { ViewMode } from "@/components/torrents/columns-popover"

interface ToolbarProps {
  hasSelection: boolean
  search: string
  onSearchChange: (value: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sort: SortState | null
  sortOptions: { id: string; label: string }[]
  onSortFieldChange: (id: string) => void
  onSortDirectionToggle: () => void
  onAdd: () => void
  onStart: () => void
  onPause: () => void
  onRemove: () => void
  onOpenSettings: () => void
  altSpeedEnabled: boolean
  onToggleAltSpeed: () => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  /** Leading slot: mobile menu button or sidebar reopen button. */
  sidebarSlot?: React.ReactNode
  /** Filters/columns popovers. */
  trailingSlot?: React.ReactNode
}

function ActionButton(props: {
  label: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  variant?: "default" | "outline" | "ghost"
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={props.variant ?? "ghost"}
          size="icon"
          className={cn("size-9 sm:size-8", props.active && "bg-accent text-foreground")}
          disabled={props.disabled}
          onClick={props.onClick}
          aria-label={props.label}
          aria-pressed={props.active}
        >
          {props.children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  )
}


export function Toolbar({
  hasSelection,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sort,
  sortOptions,
  onSortFieldChange,
  onSortDirectionToggle,
  onAdd,
  onStart,
  onPause,
  onRemove,
  onOpenSettings,
  altSpeedEnabled,
  onToggleAltSpeed,
  searchRef,
  sidebarSlot,
  trailingSlot,
}: ToolbarProps) {
  return (
    <div className="flex h-12 min-w-0 items-center gap-1.5 overflow-x-auto border-b px-2">
      {sidebarSlot}

      <ActionButton label="Add torrent" onClick={onAdd} variant="default">
        <Plus className="size-4" />
      </ActionButton>

      <ActionButton label="Start selected" disabled={!hasSelection} onClick={onStart}>
        <Play className="size-4" />
      </ActionButton>
      <ActionButton label="Pause selected" disabled={!hasSelection} onClick={onPause}>
        <Pause className="size-4" />
      </ActionButton>

      <ActionButton label="Remove selected" disabled={!hasSelection} onClick={onRemove}>
        <Trash2 className="size-4" />
      </ActionButton>

      <ActionButton
        label={
          altSpeedEnabled
            ? "Alternative speed limit is on — click to disable"
            : "Alternative speed limit is off — click to enable"
        }
        active={altSpeedEnabled}
        onClick={onToggleAltSpeed}
      >
        <Turtle className="size-4" />
      </ActionButton>

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-1.5">
        <Select
          value={sort?.id ?? "default"}
          onValueChange={(value) => onSortFieldChange(value === "default" ? "" : value)}
        >
          <SelectTrigger
            size="sm"
            className="h-9 gap-1 border-transparent bg-transparent px-1.5 text-xs shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent sm:h-8"
            aria-label="Sort by"
          >
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default order</SelectItem>
            {sortOptions.map((option) => (
              <SelectItem key={option.id} value={option.id} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ActionButton
          label={sort?.desc ? "Sort descending" : "Sort ascending"}
          disabled={!sort}
          onClick={onSortDirectionToggle}
        >
          <span className="text-sm font-semibold leading-none">
            {sort?.desc ? "↓" : "↑"}
          </span>
        </ActionButton>

        {trailingSlot}

        <div
          className="flex h-9 shrink-0 items-center rounded-lg bg-muted p-[3px] sm:h-8"
          role="group"
          aria-label="View mode"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-[30px] w-9 items-center justify-center rounded-md text-muted-foreground transition-all hover:text-foreground sm:h-[26px] sm:w-7",
                  viewMode === "compact" && "bg-background text-foreground shadow-sm",
                )}
                onClick={() => onViewModeChange("compact")}
                aria-label="Compact view"
                aria-pressed={viewMode === "compact"}
              >
                <List className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Compact view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-[30px] w-9 items-center justify-center rounded-md text-muted-foreground transition-all hover:text-foreground sm:h-[26px] sm:w-7",
                  viewMode === "rich" && "bg-background text-foreground shadow-sm",
                )}
                onClick={() => onViewModeChange("rich")}
                aria-label="Rich view"
                aria-pressed={viewMode === "rich"}
              >
                <ListTree className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Rich view</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search…"
          className="h-9 w-40 pl-7 text-sm sm:h-8 md:w-56"
          aria-label="Search torrents"
        />
      </div>

      <ActionButton label="Settings" onClick={onOpenSettings}>
        <Settings className="size-4" />
      </ActionButton>
    </div>
  )
}
