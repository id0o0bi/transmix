import { toast } from "sonner"
import {
  CheckCheck,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  CirclePause,
  CirclePlay,
  Ellipsis,
  FolderInput,
  Magnet,
  RefreshCw,
  Settings2,
  Tag,
  Trash2,
  Wifi,
  Zap,
} from "lucide-react"
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import { useTorrentActions } from "@/hooks/use-torrent-actions"
import { rpc, type TorrentActionMethod } from "@/lib/transmission"

interface TaskContextMenuProps {
  /** The menu operates on the current selection. */
  selectedIds: number[]
  onRemove: () => void
  onMove: () => void
  onLabels: () => void
  onTrackers: () => void
  onProperties: () => void
}

export function TaskContextMenuContent({
  selectedIds,
  onRemove,
  onMove,
  onLabels,
  onTrackers,
  onProperties,
}: TaskContextMenuProps) {
  const actions = useTorrentActions()
  const disabled = selectedIds.length === 0

  const run = (method: TorrentActionMethod) => {
    void actions.runAction(method, selectedIds)
  }

  const copyMagnet = async () => {
    if (selectedIds.length === 0) return
    try {
      const { torrents } = await rpc.torrentGet<{ magnetLink: string }>(
        ["magnetLink"],
        selectedIds,
      )
      const links = torrents.map((t) => t.magnetLink).filter((link) => link !== "")
      await navigator.clipboard.writeText(links.join("\n"))
      toast.success(`Magnet link${selectedIds.length > 1 ? "s" : ""} copied to clipboard`)
    } catch (err) {
      toast.error("Copy failed", { description: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <ContextMenuContent>
      <ContextMenuItem disabled={disabled} onSelect={() => run("torrent-start-now")}>
        <Zap /> Force start
      </ContextMenuItem>
      <ContextMenuItem disabled={disabled} onSelect={() => run("torrent-start")}>
        <CirclePlay /> Start
      </ContextMenuItem>
      <ContextMenuItem disabled={disabled} onSelect={() => run("torrent-stop")}>
        <CirclePause /> Pause
      </ContextMenuItem>
      <ContextMenuItem disabled={disabled} onSelect={() => run("torrent-verify")}>
        <CheckCheck /> Verify
      </ContextMenuItem>
      <ContextMenuItem disabled={disabled} onSelect={() => run("torrent-reannounce")}>
        <RefreshCw /> Reannounce
      </ContextMenuItem>
      <ContextMenuItem disabled={disabled} onSelect={() => void copyMagnet()}>
        <Magnet /> Copy magnet link{selectedIds.length > 1 ? "s" : ""}
      </ContextMenuItem>

      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={disabled}>
          <Ellipsis /> Queue
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem disabled={disabled} onSelect={() => run("queue-move-top")}>
            <ChevronsUp /> Move to top
          </ContextMenuItem>
          <ContextMenuItem disabled={disabled} onSelect={() => run("queue-move-up")}>
            <ChevronUp /> Move up
          </ContextMenuItem>
          <ContextMenuItem disabled={disabled} onSelect={() => run("queue-move-down")}>
            <ChevronDown /> Move down
          </ContextMenuItem>
          <ContextMenuItem disabled={disabled} onSelect={() => run("queue-move-bottom")}>
            <ChevronsDown /> Move to bottom
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuItem disabled={disabled} onSelect={onMove}>
        <FolderInput /> Move…
      </ContextMenuItem>
      <ContextMenuItem disabled={disabled} onSelect={onLabels}>
        <Tag /> Set labels…
      </ContextMenuItem>
      <ContextMenuItem disabled={disabled} variant="destructive" onSelect={onRemove}>
        <Trash2 /> Remove…
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem disabled={disabled} onSelect={onTrackers}>
        <Wifi /> Trackers…
      </ContextMenuItem>
      <ContextMenuItem disabled={disabled} onSelect={onProperties}>
        <Settings2 /> Properties…
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
