import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/hooks/use-session"
import { rpc, type Peer, type TrackerStats } from "@/lib/transmission"

export interface TorrentFileEntry {
  index: number
  name: string
  length: number
  bytesCompleted: number
  wanted: boolean
  priority: number
}

export interface TorrentTrackerEntry {
  id: number
  announce: string
  scrape: string
  flags: string
  tier: number
  stats?: TrackerStats
}

export interface TorrentTrackersData {
  hashString: string
  /** trackerList field (rpc >= 17 only). */
  trackerList?: string
  trackers: TorrentTrackerEntry[]
}

export function useTorrentFiles(id: number | null) {
  return useQuery({
    queryKey: ["torrent-files", id],
    enabled: id !== null,
    refetchInterval: 2_000,
    staleTime: 1_000,
    queryFn: async () => {
      const { torrents } = await rpc.torrentGet<{
        files: { name: string; length: number; bytesCompleted: number }[]
        fileStats: { wanted: boolean; priority: number }[]
      }>(["files", "fileStats"], id as number)
      const t = torrents[0]
      if (t === undefined) return []
      return t.files.map<TorrentFileEntry>((f, i) => ({
        index: i,
        name: f.name,
        length: f.length,
        bytesCompleted: f.bytesCompleted,
        wanted: t.fileStats[i]?.wanted ?? true,
        priority: t.fileStats[i]?.priority ?? 0,
      }))
    },
  })
}

export function useTorrentTrackers(id: number | null) {
  const rpcVersion = useSession().data?.["rpc-version"] ?? 17
  const supportsTrackerList = rpcVersion >= 17
  return useQuery({
    queryKey: ["torrent-trackers", id, supportsTrackerList],
    enabled: id !== null,
    refetchInterval: 3_000,
    staleTime: 1_000,
    queryFn: async (): Promise<TorrentTrackersData> => {
      const fields: string[] = ["trackers", "trackerStats", "hashString"]
      if (supportsTrackerList) fields.push("trackerList")
      const { torrents } = await rpc.torrentGet<{
        trackers: { id: number; announce: string; scrape: string; flags: string; tier: number }[]
        trackerStats: TrackerStats[]
        hashString: string
        trackerList?: string
      }>(fields, id as number)
      const t = torrents[0]
      if (t === undefined) return { hashString: "", trackers: [] }
      return {
        hashString: t.hashString,
        trackerList: t.trackerList,
        trackers: t.trackers.map((tr) => ({
          id: tr.id,
          announce: tr.announce,
          scrape: tr.scrape ?? "",
          flags: tr.flags ?? "",
          tier: tr.tier ?? 0,
          stats: t.trackerStats.find((s) => s.announce === tr.announce),
        })),
      }
    },
  })
}

export interface TorrentPieces {
  pieceCount: number
  pieceSize: number
  bytes: Uint8Array
  wanted: Uint8Array
}

function decodeBitfield(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function useTorrentPieces(id: number | null) {
  return useQuery({
    queryKey: ["torrent-pieces", id],
    enabled: id !== null,
    refetchInterval: 2_000,
    staleTime: 1_000,
    queryFn: async (): Promise<TorrentPieces | null> => {
      const { torrents } = await rpc.torrentGet<{
        pieces: string
        pieceCount: number
        pieceSize: number
        totalSize: number
        files: { length: number }[]
        fileStats: { wanted: boolean }[]
      }>(["pieces", "pieceCount", "pieceSize", "totalSize", "files", "fileStats"], id as number)
      const t = torrents[0]
      if (t === undefined || t.pieceCount <= 0) return null

      const wanted = new Uint8Array(t.pieceCount)
      let pos = 0
      t.files.forEach((f, i) => {
        if ((t.fileStats[i]?.wanted ?? true) && f.length > 0 && t.pieceSize > 0) {
          const first = Math.floor(pos / t.pieceSize)
          const last = Math.floor((pos + f.length - 1) / t.pieceSize)
          for (let p = first; p <= last && p < t.pieceCount; p++) wanted[p] = 1
        }
        pos += f.length
      })

      return {
        pieceCount: t.pieceCount,
        pieceSize: t.pieceSize,
        bytes: decodeBitfield(t.pieces),
        wanted,
      }
    },
  })
}

export function useTorrentPeers(id: number | null) {
  return useQuery({
    queryKey: ["torrent-peers", id],
    enabled: id !== null,
    refetchInterval: 2_000,
    staleTime: 1_000,
    queryFn: async () => {
      const { torrents } = await rpc.torrentGet<{ peers: Peer[] }>(["peers"], id as number)
      return torrents[0]?.peers ?? []
    },
  })
}
