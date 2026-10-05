import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock3,
  Magnet,
  PauseCircle,
  RefreshCw,
} from "lucide-react"
import { Status, type StatusType } from "@/lib/transmission"
import type { CachedTorrent } from "@/lib/torrents"
import { cn } from "@/lib/utils"

interface StatusIconProps {
  torrent: CachedTorrent
  className?: string
}

export function StatusIcon({ torrent: t, className }: StatusIconProps) {
  const props = { className: cn("size-4", className), "aria-hidden": true }

  if (t.error !== 0 || t.cachedError !== "") {
    return <AlertCircle {...props} className={cn(props.className, "text-red-500")} />
  }

  if (t.status === Status.downloading && t.pieceCount === 0) {
    return <Magnet {...props} className={cn(props.className, "text-sky-500")} />
  }

  switch (t.status as StatusType) {
    case Status.downloading:
      return <ArrowDownCircle {...props} className={cn(props.className, "text-sky-500")} />
    case Status.seeding:
      return <ArrowUpCircle {...props} className={cn(props.className, "text-emerald-500")} />
    case Status.verifying:
      return <RefreshCw {...props} className={cn(props.className, "text-violet-500")} />
    case Status.queuedToVerify:
    case Status.queuedToDownload:
    case Status.queuedToSeed:
      return <Clock3 {...props} className={cn(props.className, "text-zinc-400")} />
    case Status.stopped:
    default: {
      if (t.sizeWhenDone > 0 && t.leftUntilDone === 0) {
        return <CheckCircle2 {...props} className={cn(props.className, "text-green-600 dark:text-green-500")} />
      }
      return <PauseCircle {...props} className={cn(props.className, "text-zinc-400")} />
    }
  }
}
