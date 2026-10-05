import { useVirtualizer } from "@tanstack/react-virtual"
import { useMemo, useRef, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  Folder,
  Minus,
  Search,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTorrentActions } from "@/hooks/use-torrent-actions"
import { useTorrentFiles, type TorrentFileEntry } from "@/hooks/use-torrent-detail"
import { formatBytes } from "@/lib/format"
import {
  baseName,
  buildTree,
  dirPercent,
  dirPriority,
  filePercent,
  type DirNode,
} from "@/lib/file-tree"
import { loadPref, savePref } from "@/lib/prefs"
import { cn } from "@/lib/utils"

const ROW_HEIGHT = 32

type SortKey = "name" | "percent" | "size" | "priority"

function priorityValueKey(priority: number): string {
  return priority === 1 ? "priority-high" : priority === -1 ? "priority-low" : "priority-normal"
}

function percentText(done: number, total: number): string {
  if (total <= 0) return "100%"
  const pct = (done / total) * 100
  if (pct >= 99.95) return "100%"
  if (pct < 0.05) return "0%"
  return `${pct.toFixed(1)}%`
}

interface FlatRow {
  key: string
  name: string
  title: string
  level: number
  isDir: boolean
  index: number
  indices: number[]
  length: number
  done: number
  wanted: boolean
  mixed: boolean
  priority: number | null
  dir: DirNode | null
}

function fileRow(f: TorrentFileEntry, flat: boolean): FlatRow {
  const level = f.name.split("/").length - 1
  return {
    key: f.name,
    name: flat ? f.name : baseName(f.name),
    title: f.name,
    level: flat ? 0 : level,
    isDir: false,
    index: f.index,
    indices: [f.index],
    length: f.length,
    done: f.bytesCompleted,
    wanted: f.wanted,
    mixed: false,
    priority: f.priority,
    dir: null,
  }
}

function dirRow(d: DirNode): FlatRow {
  return {
    key: d.key,
    name: d.name,
    title: d.key,
    level: d.level,
    isDir: true,
    index: -1,
    indices: d.indices,
    length: d.length,
    done: d.done,
    wanted: d.wantedCount === d.indices.length,
    mixed: d.wantedCount > 0 && d.wantedCount < d.indices.length,
    priority: dirPriority(d),
    dir: d,
  }
}

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-400",
  normal: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  low: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  mixed: "bg-muted text-muted-foreground",
}

function PriorityTag({ priority, title }: { priority: number | null; title?: string }) {
  const kind = priority === 1 ? "high" : priority === -1 ? "low" : priority === 0 ? "normal" : "mixed"
  const label = kind === "high" ? "High" : kind === "low" ? "Low" : kind === "normal" ? "Normal" : "Mixed"
  return (
    <Badge
      variant="outline"
      className={cn("h-5 justify-center px-1.5 text-[11px] font-medium", PRIORITY_STYLE[kind])}
      title={title}
    >
      {label}
    </Badge>
  )
}

function SortHead(props: {
  label: string
  className?: string
  active: boolean
  desc: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "flex h-full items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
        props.className,
      )}
    >
      <span className="truncate">{props.label}</span>
      {props.active &&
        (props.desc ? <ArrowDown className="size-3 shrink-0" /> : <ArrowUp className="size-3 shrink-0" />)}
    </button>
  )
}

export function FileList({ torrentId }: { torrentId: number }) {
  const { data, isLoading, isError, error } = useTorrentFiles(torrentId)
  const actions = useTorrentActions()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDesc, setSortDesc] = useState(false)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [treeView, setTreeView] = useState<boolean>(() => loadPref<boolean>("filesTreeView", true))
  const [search, setSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [ctxRow, setCtxRow] = useState<FlatRow | null>(null)

  const files = useMemo(() => data ?? [], [data])

  const terms = useMemo(
    () => search.trim().toLowerCase().split(/\s+/).filter((t) => t !== ""),
    [search],
  )

  const sourceFiles = useMemo(() => {
    if (terms.length === 0) return files
    return files.filter((f) => terms.every((t) => f.name.toLowerCase().includes(t)))
  }, [files, terms])

  const dirKeys = useMemo(() => {
    const keys: string[] = []
    const walk = (ds: DirNode[]) => {
      for (const d of ds) {
        keys.push(d.key)
        walk(d.dirs)
      }
    }
    walk(buildTree(files).filter((r) => r.level >= 0))
    return keys
  }, [files])

  const changeTreeView = (tree: boolean) => {
    setTreeView(tree)
    savePref("filesTreeView", tree)
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((d) => !d)
    } else {
      setSortKey(key)
      setSortDesc(key === "percent" || key === "size" || key === "priority")
    }
  }

  const toggleDir = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => setCollapsed(new Set(dirKeys))

  const rows = useMemo(() => {
    const dir = sortDesc ? -1 : 1

    const dirCmp = (a: DirNode, b: DirNode): number => {
      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name)
        case "percent":
          return dir * (dirPercent(a) - dirPercent(b))
        case "size":
          return dir * (a.length - b.length)
        case "priority":
          return dir * ((dirPriority(a) ?? 0) - (dirPriority(b) ?? 0))
        default:
          return 0
      }
    }
    const fileCmp = (a: TorrentFileEntry, b: TorrentFileEntry): number => {
      switch (sortKey) {
        case "name":
          return dir * baseName(a.name).localeCompare(baseName(b.name))
        case "percent":
          return dir * (filePercent(a) - filePercent(b))
        case "size":
          return dir * (a.length - b.length)
        case "priority":
          return dir * (a.priority - b.priority)
        default:
          return 0
      }
    }

    const out: FlatRow[] = []
    if (!treeView) {
      const fs = sortKey !== null ? [...sourceFiles].sort(fileCmp) : sourceFiles
      for (const f of fs) out.push(fileRow(f, true))
      return out
    }

    const roots = buildTree(sourceFiles)
    // While searching, keep every matching branch expanded.
    const keepOpen = terms.length > 0
    const walk = (levelDirs: DirNode[], levelFiles: TorrentFileEntry[]) => {
      const dirs = sortKey !== null ? [...levelDirs].sort(dirCmp) : levelDirs
      const fs = sortKey !== null ? [...levelFiles].sort(fileCmp) : levelFiles
      for (const d of dirs) {
        out.push(dirRow(d))
        if (keepOpen || !collapsed.has(d.key)) walk(d.dirs, d.files)
      }
      for (const f of fs) out.push(fileRow(f, false))
    }
    const rootDirs = roots.filter((r) => r.level >= 0)
    const rootFiles: TorrentFileEntry[] = []
    const rootDirsSet = new Set(rootDirs)
    for (const r of roots) {
      if (!rootDirsSet.has(r)) rootFiles.push(...r.files)
    }
    walk(rootDirs, rootFiles)
    return out
  }, [sourceFiles, sortKey, sortDesc, collapsed, treeView, terms])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const setWanted = (indices: number[], wanted: boolean) => {
    void actions.setFields([torrentId], wanted ? { "files-wanted": indices } : { "files-unwanted": indices })
  }

  const applyPriority = (priority: number) => {
    if (ctxRow === null) return
    void actions.setFields([torrentId], { [priorityValueKey(priority)]: ctxRow.indices })
  }

  const applyWanted = (wanted: boolean) => {
    if (ctxRow === null) return
    setWanted(ctxRow.indices, wanted)
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        Loading files…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
        Failed to load files: {error instanceof Error ? error.message : String(error)}
      </div>
    )
  }
  if (files.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        No file information yet.
      </div>
    )
  }

  const allWanted = files.every((f) => f.wanted)
  const someWanted = files.some((f) => f.wanted)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="absolute inset-0 flex flex-col"
          onContextMenu={(e) => {
            if (!(e.target as HTMLElement).closest("[data-file-row]")) setCtxRow(null)
          }}
        >
          <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
            <Checkbox
              checked={allWanted ? true : someWanted ? "indeterminate" : false}
              onCheckedChange={(checked) => setWanted(files.map((f) => f.index), checked === true)}
              aria-label="Toggle all files"
            />
            <span className="flex h-full min-w-0 flex-1 items-center gap-1.5">
              <SortHead
                label="Name"
                className={searchOpen ? "shrink-0" : "min-w-0 flex-1"}
                active={sortKey === "name"}
                desc={sortDesc}
                onClick={() => toggleSort("name")}
              />
              {searchOpen && (
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      setSearchOpen(false)
                    } else if (e.key === "Escape") {
                      e.preventDefault()
                      e.stopPropagation()
                      setSearch("")
                      setSearchOpen(false)
                    }
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="Search files…"
                  aria-label="Search files"
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                  className="h-6 min-w-0 flex-1 px-2 text-xs"
                />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setSearchOpen((open) => !open)}
                    aria-label="Search files"
                    aria-pressed={searchOpen || search !== ""}
                  >
                    <Search
                      className={cn(
                        "size-3.5",
                        (searchOpen || search !== "") && "text-foreground",
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Search files</TooltipContent>
              </Tooltip>
            </span>
            <SortHead
              label="%"
              className="w-12 shrink-0 justify-end"
              active={sortKey === "percent"}
              desc={sortDesc}
              onClick={() => toggleSort("percent")}
            />
            <SortHead
              label="Size"
              className="w-20 shrink-0 justify-end"
              active={sortKey === "size"}
              desc={sortDesc}
              onClick={() => toggleSort("size")}
            />
            <SortHead
              label="Priority"
              className="w-[86px] shrink-0"
              active={sortKey === "priority"}
              desc={sortDesc}
              onClick={() => toggleSort("priority")}
            />
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
            {rows.length === 0 ? (
              <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
                No files match “{search.trim()}”.
              </div>
            ) : (
            <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((vr) => {
                const row = rows[vr.index]
                if (row === undefined) return null
                return (
                  <div
                    key={row.key}
                    data-file-row=""
                    className={cn(
                      "absolute inset-x-0 flex items-center gap-2 px-3",
                      row.wanted ? "hover:bg-accent/40" : "opacity-50 hover:bg-accent/40",
                    )}
                    style={{ transform: `translateY(${vr.start}px)`, height: ROW_HEIGHT }}
                    onContextMenu={() => setCtxRow(row)}
                  >
                    <Checkbox
                      checked={row.mixed ? "indeterminate" : row.wanted}
                      onCheckedChange={(checked) => setWanted(row.indices, checked === true)}
                      aria-label={`${row.isDir ? "Directory" : "File"} ${row.title}`}
                    />
                    <span className="flex min-w-0 flex-1 items-center gap-1">
                      <span className="shrink-0" style={{ width: row.level * 14 }} />
                      {row.isDir ? (
                        <button
                          type="button"
                          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                          onClick={() => toggleDir(row.key)}
                          aria-expanded={!collapsed.has(row.key)}
                          aria-label={`${collapsed.has(row.key) ? "Expand" : "Collapse"} ${row.title}`}
                        >
                          {collapsed.has(row.key) ? (
                            <ChevronRight className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="size-4 shrink-0" />
                      )}
                      {row.isDir ? (
                        <Folder className="size-3.5 shrink-0 text-muted-foreground/70" />
                      ) : (
                        <FileText className="size-3.5 shrink-0 text-muted-foreground/70" />
                      )}
                      <span className="truncate text-xs" title={row.title}>
                        {row.name}
                      </span>
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {percentText(row.done, row.length)}
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {formatBytes(row.length)}
                    </span>
                    <span className="flex w-[86px] shrink-0 items-center">
                      <PriorityTag
                        priority={row.priority}
                        title={
                          row.isDir && row.priority === null ? "Mixed priorities" : undefined
                        }
                      />
                    </span>
                  </div>
                )
              })}
            </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem disabled={ctxRow === null} onSelect={() => applyPriority(1)}>
          <span className="size-2 shrink-0 rounded-full bg-red-500" />
          High priority
        </ContextMenuItem>
        <ContextMenuItem disabled={ctxRow === null} onSelect={() => applyPriority(0)}>
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
          Normal priority
        </ContextMenuItem>
        <ContextMenuItem disabled={ctxRow === null} onSelect={() => applyPriority(-1)}>
          <span className="size-2 shrink-0 rounded-full bg-amber-500" />
          Low priority
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={ctxRow === null} onSelect={() => applyWanted(true)}>
          <Check className="size-3.5" />
          Set wanted
        </ContextMenuItem>
        <ContextMenuItem disabled={ctxRow === null} onSelect={() => applyWanted(false)}>
          <Minus className="size-3.5" />
          Set unwanted
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!treeView} onSelect={expandAll}>
          <ChevronsUpDown className="size-3.5" />
          Expand all
        </ContextMenuItem>
        <ContextMenuItem disabled={!treeView} onSelect={collapseAll}>
          <ChevronsDownUp className="size-3.5" />
          Collapse all
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => changeTreeView(!treeView)}>
          <Check className={cn("size-3.5", !treeView && "invisible")} />
          Show as tree
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

