import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { decorateTorrent, type CachedTorrent } from "@/lib/torrents"
import { rpc, type Torrent } from "@/lib/transmission"

export function useTorrentList(fields: string[]) {
  const fieldKey = fields.join(",")
  return useQuery({
    queryKey: ["torrents", fieldKey],
    queryFn: async () => {
      const { torrents } = await rpc.torrentGet<Torrent>(fieldKey.split(","))
      return torrents.map(decorateTorrent)
    },
    refetchInterval: 1_000,
    refetchIntervalInBackground: true,
    staleTime: 500,
    placeholderData: keepPreviousData,
  })
}

export type TorrentList = CachedTorrent[]
