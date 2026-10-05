import { useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { toast } from "sonner"
import { rpc, type TorrentActionMethod } from "@/lib/transmission"

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useTorrentActions() {
  const queryClient = useQueryClient()

  return useMemo(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["torrents"] })
    }
    return {
      async runAction(method: TorrentActionMethod, ids: number[]): Promise<boolean> {
        if (ids.length === 0) return false
        try {
          await rpc.torrentAction(method, ids)
          invalidate()
          return true
        } catch (err) {
          toast.error("Action failed", { description: errorMessage(err) })
          return false
        }
      },

      async remove(ids: number[], deleteLocalData: boolean): Promise<boolean> {
        if (ids.length === 0) return false
        try {
          await rpc.torrentRemove(ids, deleteLocalData)
          invalidate()
          toast.success(
            `${ids.length} torrent${ids.length > 1 ? "s" : ""} removed${deleteLocalData ? " with data" : ""}`,
          )
          return true
        } catch (err) {
          toast.error("Remove failed", { description: errorMessage(err) })
          return false
        }
      },

      async moveLocation(ids: number[], location: string, moveFiles: boolean): Promise<boolean> {
        if (ids.length === 0) return false
        try {
          await rpc.torrentSetLocation(ids, location, moveFiles)
          invalidate()
          toast.success("Download location updated")
          return true
        } catch (err) {
          toast.error("Move failed", { description: errorMessage(err) })
          return false
        }
      },

      async setFields(ids: number[], fields: Record<string, unknown>): Promise<boolean> {
        if (ids.length === 0) return false
        try {
          await rpc.torrentSet(ids, fields)
          void queryClient.invalidateQueries({ queryKey: ["torrents"] })
          void queryClient.invalidateQueries({ queryKey: ["torrent-files"] })
          void queryClient.invalidateQueries({ queryKey: ["torrent-trackers"] })
          void queryClient.invalidateQueries({ queryKey: ["torrent-settings"] })
          return true
        } catch (err) {
          toast.error("Update failed", { description: errorMessage(err) })
          return false
        }
      },
    }
  }, [queryClient])
}
