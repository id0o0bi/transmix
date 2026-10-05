import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Menu, PanelLeftOpen, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Toolbar } from "@/components/layout/toolbar"
import { Sidebar } from "@/components/layout/sidebar"
import { SettingsDialog } from "@/components/layout/settings-dialog"
import { DetailsPanel } from "@/components/layout/details-panel"
import { CompactTable, type SortState, type TableSelectionProps } from "@/components/torrents/compact-table"
import { RichTable } from "@/components/torrents/rich-table"
import { FiltersPopover } from "@/components/torrents/filters-popover"
import { ColumnsPopover, type ViewMode } from "@/components/torrents/columns-popover"
import { AddDialog, type AddPayload } from "@/components/torrents/add-dialog"
import { RemoveDialog } from "@/components/torrents/remove-dialog"
import { MoveDialog } from "@/components/torrents/move-dialog"
import { LabelsDialog } from "@/components/torrents/labels-dialog"
import { TaskContextMenuContent } from "@/components/torrents/task-context-menu"
import { TorrentSettingsDialog } from "@/components/torrents/torrent-settings-dialog"
import {
  compareFields,
  defaultCompactOrder,
  defaultRichOrder,
  fieldsById,
  requiredTorrentFields,
} from "@/components/torrents/fields"
import { useTorrentList } from "@/hooks/use-torrent-list"
import { errorMessage, useTorrentActions } from "@/hooks/use-torrent-actions"
import { useSession } from "@/hooks/use-session"
import { useTorrentSelection } from "@/hooks/use-torrent-selection"
import { useSpeedHistory } from "@/hooks/use-speed-history"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { loadPref, savePref } from "@/lib/prefs"
import { readAsBase64 } from "@/lib/files"
import { useDragResize } from "@/lib/use-drag"
import {
  filterTorrents,
  parseFilterState,
  parseSearchTerms,
  serializeFilterState,
  type CachedTorrent,
  type TorrentFilterState,
} from "@/lib/torrents"
import { rpc, Status, type SessionInfo } from "@/lib/transmission"
import { cn } from "@/lib/utils"

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value))
}

function isTypingTarget(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  )
}

function extractAddUrls(dt: DataTransfer): string[] {
  const raw = `${dt.getData("text/plain")}\n${dt.getData("text/uri-list")}`
  const urls: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (t === "" || t.startsWith("#")) continue
    if (/^magnet:\?/i.test(t) || /^https?:\/\/\S+\.torrent(\?\S*)?$/i.test(t)) {
      if (!urls.includes(t)) urls.push(t)
    }
  }
  return urls
}

function sanitizeOrder(order: unknown, allowed: string[], fallback: string[]): string[] {
  if (!Array.isArray(order)) return fallback
  const valid = order.filter((id): id is string => typeof id === "string" && allowed.includes(id))
  return valid.length > 0 ? valid : fallback
}

function loadOrder(key: string, fallback: string[]): string[] {
  return sanitizeOrder(loadPref<unknown>(key, null), fallback, fallback)
}

const SIDEBAR_MIN = 200
const SIDEBAR_MAX = 480
const DETAILS_MIN = 150
const DETAILS_MAX = 600
const DETAILS_DEFAULT = 260

const MemoToolbar = memo(Toolbar)
const MemoSidebar = memo(Sidebar)
const MemoRichTable = memo(RichTable)
const MemoCompactTable = memo(CompactTable)
const MemoDetailsPanel = memo(DetailsPanel)


export function AppLayout() {
  const isMobile = useIsMobile()

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    loadPref<ViewMode>("viewMode", "compact"),
  )
  const [compactOrder, setCompactOrder] = useState<string[]>(() =>
    loadOrder("compactOrder", defaultCompactOrder),
  )
  const [compactWidths, setCompactWidths] = useState<Record<string, number>>(() =>
    loadPref<Record<string, number>>("compactWidths", {}),
  )
  const [richOrder, setRichOrder] = useState<string[]>(() =>
    loadOrder("richOrder", defaultRichOrder),
  )
  const [sort, setSort] = useState<SortState | null>(() => loadPref<SortState | null>("sort", null))

  const [filter, setFilter] = useState<TorrentFilterState>(() =>
    parseFilterState(loadPref<unknown>("filter", null)),
  )
  const [search, setSearch] = useState(() => loadPref<string>("search", ""))

  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    clamp(SIDEBAR_MIN, SIDEBAR_MAX, loadPref<number>("sidebarWidth", 260)),
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    loadPref<boolean>("sidebarCollapsed", false),
  )
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false)
  const [detailsHeight, setDetailsHeight] = useState<number>(() =>
    clamp(DETAILS_MIN, DETAILS_MAX, loadPref<number>("detailsPx", DETAILS_DEFAULT)),
  )

  const [addOpen, setAddOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [propsOpen, setPropsOpen] = useState(false)
  const [detailsTab, setDetailsTab] = useState("info")
  const [dragOver, setDragOver] = useState(false)

  const selection = useTorrentSelection()
  const actions = useTorrentActions()
  const queryClient = useQueryClient()
  const session = useSession()
  const altSpeedEnabled = session.data?.["alt-speed-enabled"] ?? false
  const searchRef = useRef<HTMLInputElement | null>(null)

  // ----- data -----
  const fields = useMemo(
    () => requiredTorrentFields(compactOrder, richOrder, viewMode === "rich"),
    [compactOrder, richOrder, viewMode],
  )
  const listQuery = useTorrentList(fields)
  const torrents = listQuery.data
  const points = useSpeedHistory(torrents)

  useEffect(() => {
    if (torrents !== undefined) selection.prune(torrents.map((t) => t.id))
  }, [torrents, selection])

  const searchTerms = useMemo(() => parseSearchTerms(search), [search])

  const visibleTorrents = useMemo(() => {
    if (torrents === undefined) return []
    const filtered = filterTorrents(torrents, filter, searchTerms)
    if (sort === null) return filtered
    const field = fieldsById[sort.id]
    if (field === undefined) return filtered
    return [...filtered].sort((a, b) => compareFields(a, b, field, sort.desc))
  }, [torrents, filter, searchTerms, sort])

  const currentTorrent: CachedTorrent | null =
    torrents?.find((t) => t.id === selection.current) ?? null

  const selectedIds = useMemo(
    () => visibleTorrents.filter((t) => selection.selected.has(t.id)).map((t) => t.id),
    [visibleTorrents, selection.selected],
  )
  const selectedIdsRef = useRef(selectedIds)
  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])
  const selectedTorrents = useMemo(
    () => (torrents ?? []).filter((t) => selection.selected.has(t.id)),
    [torrents, selection.selected],
  )

  // ----- prefs persistence -----
  const changeViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    savePref("viewMode", mode)
  }, [])

  const changeCompactOrder = useCallback((order: string[]) => {
    setCompactOrder(order)
    savePref("compactOrder", order)
  }, [])

  const changeRichOrder = useCallback((order: string[]) => {
    setRichOrder(order)
    savePref("richOrder", order)
  }, [])

  const changeColumnWidth = useCallback((id: string, width: number) => {
    setCompactWidths((prev) => {
      const next = { ...prev, [id]: width }
      savePref("compactWidths", next)
      return next
    })
  }, [])

  const changeSort = useCallback((next: SortState | null) => {
    setSort(next)
    savePref("sort", next)
  }, [])

  const changeFilter = useCallback((next: TorrentFilterState) => {
    setFilter(next)
    savePref("filter", serializeFilterState(next))
  }, [])

  const changeSearch = useCallback((next: string) => {
    setSearch(next)
    savePref("search", next)
  }, [])

  const toggleAltSpeed = useCallback(() => {
    const next = !altSpeedEnabled
    queryClient.setQueryData<SessionInfo>(["session"], (old) =>
      old === undefined ? old : { ...old, "alt-speed-enabled": next },
    )
    void rpc
      .sessionSet({ "alt-speed-enabled": next })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["session"] })
      })
      .catch((err: unknown) => {
        void queryClient.invalidateQueries({ queryKey: ["session"] })
        toast.error("Failed to toggle alternative speed limit", {
          description: errorMessage(err),
        })
      })
  }, [altSpeedEnabled, queryClient])

  const openAdd = useCallback(() => setAddOpen(true), [])
  const openRemove = useCallback(() => setRemoveOpen(true), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const openProperties = useCallback(() => setPropsOpen(true), [])
  const startSelected = useCallback(() => {
    void actions.runAction("torrent-start", selectedIdsRef.current)
  }, [actions])
  const pauseSelected = useCallback(() => {
    void actions.runAction("torrent-stop", selectedIdsRef.current)
  }, [actions])
  const onCompactSortChange = useCallback(
    (id: string) => {
      changeSort(sort?.id === id ? { id, desc: !sort.desc } : { id, desc: false })
    },
    [sort, changeSort],
  )
  const closeDetails = useCallback(() => {
    selection.onClear()
    setDetailsTab("info")
  }, [selection])

  // Global keyboard shortcuts: / focus search, Esc clear selection,
  // Space start/pause, Del remove, Ctrl/Cmd+A select all.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const target = e.target
      const isTyping = isTypingTarget(target)
      const overlayOpen =
        document.querySelector('[data-slot$="-content"][data-state="open"]') !== null
      if (overlayOpen) return
      const mod = e.ctrlKey || e.metaKey

      if (e.key === "/" && !mod && !e.altKey && !isTyping) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (e.key === "Escape" && !mod && !e.altKey) {
        if (selection.selected.size > 0) {
          if (isTyping && target instanceof HTMLElement) target.blur()
          selection.onClear()
        }
        return
      }
      if (isTyping) return
      if (mod) {
        if (e.key === "a" && !e.altKey && !e.shiftKey) {
          e.preventDefault()
          selection.onSelectAll(visibleTorrents.map((t) => t.id))
        }
        return
      }
      if (e.altKey || e.shiftKey) return

      if (e.key === " ") {
        const active = document.activeElement
        if (
          active instanceof HTMLElement &&
          active.closest("button, a, [role=button], [role=checkbox], [role=tab], [role=menuitem]") !== null
        ) {
          return
        }
        if (selectedIds.length === 0) return
        e.preventDefault()
        const allStopped = selectedIds.every((id) => {
          const t = torrents?.find((x) => x.id === id)
          return t === undefined || t.status === Status.stopped
        })
        void actions.runAction(allStopped ? "torrent-start" : "torrent-stop", selectedIds)
        return
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length === 0) return
        e.preventDefault()
        setRemoveOpen(true)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [selection, selectedIds, visibleTorrents, torrents, actions])

  const handleSortField = useCallback(
    (id: string) => {
      if (id === "") changeSort(null)
      else changeSort({ id, desc: sort?.id === id ? sort.desc : false })
    },
    [changeSort, sort],
  )

  const handleSortDirectionToggle = useCallback(() => {
    if (sort !== null) changeSort({ id: sort.id, desc: !sort.desc })
  }, [changeSort, sort])

  const changeSidebarWidth = useCallback((width: number) => {
    setSidebarWidth(width)
    savePref("sidebarWidth", width)
  }, [])

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      savePref("sidebarCollapsed", !prev)
      return !prev
    })
  }, [])

  const changeDetailsHeight = useCallback((height: number) => {
    setDetailsHeight(height)
    savePref("detailsPx", height)
  }, [])

  const sidebarDrag = useDragResize({
    axis: "x",
    onDelta: (dx) => changeSidebarWidth(clamp(SIDEBAR_MIN, SIDEBAR_MAX, sidebarWidth + dx)),
  })
  const detailsDrag = useDragResize({
    axis: "y",
    onDelta: (dy) =>
      changeDetailsHeight(clamp(DETAILS_MIN, DETAILS_MAX, detailsHeight - dy)),
  })

  // ----- actions -----
  const handleAdd = useCallback(
    async (payload: AddPayload) => {
      let added = 0
      let duplicates = 0
      let failed = 0

      const run = async (args: { filename?: string; metainfo?: string }) => {
        try {
          const result = await rpc.torrentAdd({ ...args, paused: payload.paused })
          if (result["torrent-duplicate"] !== undefined) duplicates++
          else added++
        } catch (err) {
          failed++
          toast.error("Add failed", {
            description: `${args.filename ?? "torrent"}: ${err instanceof Error ? err.message : String(err)}`,
          })
        }
      }

      for (const url of payload.urls) await run({ filename: url })
      for (const file of payload.files) await run({ metainfo: file.base64 })

      void listQuery.refetch()
      const parts: string[] = []
      if (added > 0) parts.push(`${added} added`)
      if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates > 1 ? "s" : ""}`)
      if (failed > 0) parts.push(`${failed} failed`)
      if (parts.length > 0) toast.success(parts.join(", "))
    },
    [listQuery],
  )

  // ----- drag & drop / paste to add torrents -----
  const ingestTransfer = useCallback(
    async (dt: DataTransfer) => {
      const allFiles = Array.from(dt.files)
      const torrentFiles = allFiles.filter((f) => /\.torrent$/i.test(f.name))
      const urls = extractAddUrls(dt)
      if (torrentFiles.length === 0 && urls.length === 0) {
        if (allFiles.length > 0) toast.error("Only .torrent files can be added")
        return
      }
      const files = await Promise.all(
        torrentFiles.map(async (f) => ({ filename: f.name, base64: await readAsBase64(f) })),
      )
      await handleAdd({ urls, files, paused: false })
    },
    [handleAdd],
  )

  useEffect(() => {
    let depth = 0
    const interesting = (dt: DataTransfer | null): boolean => {
      if (dt === null) return false
      const types = Array.from(dt.types)
      return types.includes("Files") || types.includes("text/plain") || types.includes("text/uri-list")
    }
    const reset = () => {
      depth = 0
      setDragOver(false)
    }
    const onDragEnter = (e: DragEvent) => {
      if (!interesting(e.dataTransfer)) return
      e.preventDefault()
      depth += 1
      setDragOver(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!interesting(e.dataTransfer)) return
      e.preventDefault()
    }
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!interesting(e.dataTransfer)) return
      e.preventDefault()
      reset()
      if (e.dataTransfer !== null) void ingestTransfer(e.dataTransfer)
    }
    document.addEventListener("dragenter", onDragEnter)
    document.addEventListener("dragover", onDragOver)
    document.addEventListener("dragleave", onDragLeave)
    document.addEventListener("dragend", reset)
    document.addEventListener("drop", onDrop)
    return () => {
      document.removeEventListener("dragenter", onDragEnter)
      document.removeEventListener("dragover", onDragOver)
      document.removeEventListener("dragleave", onDragLeave)
      document.removeEventListener("dragend", reset)
      document.removeEventListener("drop", onDrop)
    }
  }, [ingestTransfer])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData
      if (dt === null || isTypingTarget(e.target)) return
      const hasTorrentFile = Array.from(dt.files).some((f) => /\.torrent$/i.test(f.name))
      if (!hasTorrentFile && extractAddUrls(dt).length === 0) return
      e.preventDefault()
      void ingestTransfer(dt)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [ingestTransfer])

  const { selected, current, onRowClick, onCheckboxToggle, onSelectAll, onClear } = selection
  const tableSelection: TableSelectionProps = useMemo(
    () => ({
      selected,
      current,
      onRowClick,
      onCheckboxToggle,
      onSelectAll,
      onSelectNone: onClear,
      onRowDoubleClick: openProperties,
    }),
    [selected, current, onRowClick, onCheckboxToggle, onSelectAll, onClear, openProperties],
  )

  const sortOptions = useMemo(() => {
    const order = viewMode === "rich" ? richOrder : compactOrder
    return order
      .map((id) => fieldsById[id])
      .filter((f) => f !== undefined)
      .map((f) => ({ id: f.id, label: f.label }))
  }, [viewMode, richOrder, compactOrder])

  const sidebarSlot = useMemo(() => (isMobile ? (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 sm:size-8"
      onClick={() => setSidebarOpenMobile(true)}
      aria-label="Open menu"
    >
      <Menu className="size-4" />
    </Button>
  ) : sidebarCollapsed ? (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 sm:size-8"
      onClick={toggleSidebarCollapsed}
      aria-label="Show sidebar"
      title="Show sidebar"
    >
      <PanelLeftOpen className="size-4" />
    </Button>
  ) : undefined), [isMobile, sidebarCollapsed, toggleSidebarCollapsed])

  const trailingSlot = useMemo(() => (
    <div className="flex shrink-0 items-center gap-1.5">
      <FiltersPopover torrents={torrents ?? []} filter={filter} onFilterChange={changeFilter} />
      <ColumnsPopover
        mode={viewMode}
        compactOrder={compactOrder}
        richOrder={richOrder}
        onOrderChange={(mode, order) =>
          mode === "compact" ? changeCompactOrder(order) : changeRichOrder(order)
        }
      />
    </div>
  ), [torrents, filter, changeFilter, viewMode, compactOrder, richOrder, changeCompactOrder, changeRichOrder])

  const table =
    listQuery.isError && torrents === undefined ? (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <AlertCircle className="size-8 text-destructive" />
        <p>Failed to load torrents: {listQuery.error instanceof Error ? listQuery.error.message : "unknown error"}</p>
        <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
          <RefreshCw className="mr-1.5 size-4" />
          Retry
        </Button>
      </div>
    ) : torrents === undefined ? (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Connecting to Transmission…
      </div>
    ) : viewMode === "compact" ? (
      <MemoCompactTable
        data={visibleTorrents}
        order={compactOrder}
        widths={compactWidths}
        onResize={changeColumnWidth}
        sort={sort}
        onSortChange={onCompactSortChange}
        selection={tableSelection}
      />
    ) : (
      <MemoRichTable data={visibleTorrents} order={richOrder} selection={tableSelection} />
    )

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      {!isMobile && !sidebarCollapsed && (
        <>
          <div
            className="flex shrink-0 flex-col"
            style={{ width: sidebarWidth }}
          >
              <MemoSidebar
                points={points}
                onCollapse={toggleSidebarCollapsed}
              />
          </div>
          <div
            className="w-0 shrink-0 cursor-col-resize border-r transition-colors hover:bg-primary/30"
            onMouseDown={sidebarDrag}
            onDoubleClick={() => changeSidebarWidth(260)}
            aria-hidden
          />
        </>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <MemoToolbar
          hasSelection={selectedIds.length > 0}
          search={search}
          onSearchChange={changeSearch}
          viewMode={viewMode}
          onViewModeChange={changeViewMode}
          sort={sort}
          sortOptions={sortOptions}
          onSortFieldChange={handleSortField}
          onSortDirectionToggle={handleSortDirectionToggle}
          onAdd={openAdd}
          onStart={startSelected}
          onPause={pauseSelected}
          onRemove={openRemove}
          onOpenSettings={openSettings}
          altSpeedEnabled={altSpeedEnabled}
          onToggleAltSpeed={toggleAltSpeed}
          searchRef={searchRef}
          sidebarSlot={sidebarSlot}
          trailingSlot={trailingSlot}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className={cn("min-h-0 flex-1", isMobile && "overflow-hidden")}>{table}</div>
            </ContextMenuTrigger>
            <TaskContextMenuContent
              selectedIds={selectedIds}
              onRemove={() => setRemoveOpen(true)}
              onMove={() => setMoveOpen(true)}
              onLabels={() => setLabelsOpen(true)}
              onTrackers={() => setDetailsTab("trackers")}
              onProperties={() => setPropsOpen(true)}
            />
          </ContextMenu>

          {!isMobile && currentTorrent !== null && (
            <>
              <div
                className="h-1 shrink-0 cursor-row-resize border-t transition-colors hover:bg-primary/30"
                onMouseDown={detailsDrag}
                onDoubleClick={() => changeDetailsHeight(DETAILS_DEFAULT)}
                aria-hidden
              />
              <div
                className="min-h-0 shrink-0 overflow-hidden"
                style={{ height: `${detailsHeight}px` }}
              >
                <MemoDetailsPanel
                  torrent={currentTorrent}
                  onClose={closeDetails}
                  tab={detailsTab}
                  onTabChange={setDetailsTab}
                />
              </div>
            </>
          )}
        </div>
      </main>

      {/* Mobile: sidebar drawer */}
      <Sheet open={sidebarOpenMobile} onOpenChange={setSidebarOpenMobile}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">transmix menu</SheetTitle>
          <MemoSidebar
            points={points}
          />
        </SheetContent>
      </Sheet>

      {/* Mobile: full-screen details sheet */}
      {isMobile && (
        <Sheet
          open={currentTorrent !== null}
          onOpenChange={(open) => {
            if (!open) {
              selection.onClear()
              setDetailsTab("info")
            }
          }}
        >
          <SheetContent side="bottom" className="h-[85dvh] p-0">
            <SheetTitle className="sr-only">Torrent details</SheetTitle>
            <MemoDetailsPanel
              torrent={currentTorrent}
              onClose={closeDetails}
              tab={detailsTab}
              onTabChange={setDetailsTab}
            />
          </SheetContent>
        </Sheet>
      )}

      <AddDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={(payload) => void handleAdd(payload)} />
      <RemoveDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        torrents={selectedTorrents}
        onConfirm={(removeData) => {
          void actions.remove(selectedIds, removeData).then((ok) => {
            if (ok) setRemoveOpen(false)
          })
        }}
      />
      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        ids={selectedIds}
        currentPath={selectedTorrents[0]?.downloadDir}
      />
      <LabelsDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        ids={selectedIds}
        currentLabels={selectedTorrents[0]?.labels}
      />
      <TorrentSettingsDialog open={propsOpen} onOpenChange={setPropsOpen} ids={selectedIds} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/60">
          <div className="rounded-lg border-2 border-dashed border-foreground/40 px-8 py-6 text-sm font-medium">
            Drop .torrent files to add
          </div>
        </div>
      )}
    </div>
  )
}
