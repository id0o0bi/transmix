import { formatDuration } from "@/lib/format"

export class TransmissionRpcError extends Error {
  readonly httpStatus?: number

  constructor(message: string, httpStatus?: number) {
    super(message)
    this.name = "TransmissionRpcError"
    this.httpStatus = httpStatus
  }
}

interface RpcEnvelope<T> {
  result: string
  arguments: T
}

export interface SessionInfo {
  version: string
  "rpc-version": number
  "session-id"?: string
  name?: string
  "download-dir"?: string
  "download-dir-free-space"?: number
  "speed-limit-down"?: number
  "speed-limit-down-enabled"?: boolean
  "speed-limit-up"?: number
  "speed-limit-up-enabled"?: boolean
  "alt-speed-enabled"?: boolean
  "alt-speed-time-enabled"?: boolean
  "alt-speed-down"?: number
  "alt-speed-up"?: number
  "peer-port"?: number
  "peer-port-random-on-start"?: boolean
  "port-forwarding-enabled"?: boolean
  "encryption"?: string
  "peer-limit-global"?: number
  "peer-limit-per-torrent"?: number
  "pex-enabled"?: boolean
  "dht-enabled"?: boolean
  "lpd-enabled"?: boolean
  "utp-enabled"?: boolean
  "blocklist-enabled"?: boolean
  "blocklist-url"?: string
  "blocklist-size"?: number
  "seedRatioLimited"?: boolean
  "seedRatioLimit"?: number
  "start-added-torrents"?: boolean
  "sequential_download"?: boolean
  "rename-partial-files"?: boolean
  "incomplete-dir-enabled"?: boolean
  "incomplete-dir"?: string
  "idle-seeding-limit-enabled"?: boolean
  "idle-seeding-limit"?: number
  "cache-size-mb"?: number
  "alt-speed-time-begin"?: number
  "alt-speed-time-end"?: number
  "alt-speed-time-day"?: number
  "download-queue-enabled"?: boolean
  "download-queue-size"?: number
  "seed-queue-enabled"?: boolean
  "seed-queue-size"?: number
  "queue-stalled-enabled"?: boolean
  "queue-stalled-minutes"?: number
  "config-dir"?: string
}

export interface SessionStatEntry {
  downloadedBytes: number
  uploadedBytes: number
  filesAdded: number
  secondsActive: number
  sessionCount: number
}

export interface SessionStats {
  activeTorrentCount: number
  pausedTorrentCount: number
  torrentCount: number
  uploadSpeed: number
  downloadSpeed: number
  "cumulative-stats": SessionStatEntry
  "current-stats": SessionStatEntry
}

/**
 * Minimal Transmission RPC client.
 *
 * Same-origin endpoint (`../rpc` by default). The first request performs the
 * 409 `X-Transmission-Session-Id` handshake; concurrent callers share a single
 * handshake so only one 409 ever hits the wire.
 */
export class TransmissionClient {
  private sessionId: string | null = null
  private sessionRequired = true
  private handshake: Promise<void> | null = null
  private readonly url: string

  constructor(url: string = "../rpc") {
    this.url = url
  }

  async call<T = Record<string, unknown>>(method: string, args: Record<string, unknown> = {}): Promise<T> {
    await this.ensureSession()
    return this.send<T>(method, args, true)
  }

  private ensureSession(): Promise<void> {
    if (!this.sessionRequired || this.sessionId !== null) {
      return Promise.resolve()
    }
    if (this.handshake === null) {
      const attempt = (async () => {
        const res = await this.fetchRpc("session-get", {}, false)
        const sid = res.headers.get("X-Transmission-Session-Id")
        if (sid !== null) {
          this.sessionId = sid
          return
        }
        if (res.ok) {
          this.sessionRequired = false
          return
        }
        throw new TransmissionRpcError(
          `Handshake failed: HTTP ${res.status} ${res.statusText}`,
          res.status,
        )
      })()
      this.handshake = attempt.finally(() => {
        this.handshake = null
      })
    }
    return this.handshake
  }

  private async fetchRpc(
    method: string,
    args: Record<string, unknown>,
    withSession: boolean,
  ): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (withSession && this.sessionId !== null) {
      headers["X-Transmission-Session-Id"] = this.sessionId
    }
    try {
      return await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ method, arguments: args }),
      })
    } catch (err) {
      throw new TransmissionRpcError(err instanceof Error ? err.message : "Network error")
    }
  }

  private async send<T>(method: string, args: Record<string, unknown>, allowRetry: boolean): Promise<T> {
    const res = await this.fetchRpc(method, args, true)

    if (res.status === 409) {
      const sid = res.headers.get("X-Transmission-Session-Id")
      if (sid === null) {
        throw new TransmissionRpcError("409 Conflict without X-Transmission-Session-Id header", 409)
      }
      this.sessionId = sid
      if (allowRetry) {
        return this.send<T>(method, args, false)
      }
      throw new TransmissionRpcError("409 Conflict (session id not accepted)", 409)
    }

    if (!res.ok) {
      throw new TransmissionRpcError(`HTTP ${res.status} ${res.statusText}`, res.status)
    }

    let body: RpcEnvelope<T>
    try {
      body = (await res.json()) as RpcEnvelope<T>
    } catch {
      throw new TransmissionRpcError("Invalid JSON response")
    }

    if (body.result !== "success") {
      throw new TransmissionRpcError(body.result)
    }

    return body.arguments
  }

  sessionGet(fields?: string[]): Promise<SessionInfo> {
    return this.call<SessionInfo>("session-get", fields ? { fields } : {})
  }

  sessionSet(args: Record<string, unknown>): Promise<Record<string, never>> {
    return this.call("session-set", args)
  }

  portTest(): Promise<{ "port-is-open": boolean }> {
    return this.call("port-test")
  }

  blocklistUpdate(): Promise<{ "blocklist-size"?: number }> {
    return this.call("blocklist-update")
  }

  sessionStats(): Promise<SessionStats> {
    return this.call<SessionStats>("session-stats")
  }

  torrentGet<T = Record<string, unknown>>(fields: string[], ids?: number | number[]): Promise<{ torrents: T[] }> {
    const args: Record<string, unknown> = { fields }
    if (ids !== undefined) {
      args.ids = ids
    }
    return this.call<{ torrents: T[] }>("torrent-get", args)
  }

  torrentAction(method: TorrentActionMethod, ids: number[]): Promise<Record<string, never>> {
    return this.call(method, { ids })
  }

  torrentSet(ids: number[], fields: Record<string, unknown>): Promise<Record<string, never>> {
    return this.call("torrent-set", { ids, ...fields })
  }

  torrentSetLocation(ids: number[], location: string, move: boolean): Promise<Record<string, never>> {
    return this.call("torrent-set-location", { ids, location, move })
  }

  torrentRemove(ids: number[], deleteLocalData: boolean): Promise<Record<string, never>> {
    return this.call("torrent-remove", { ids, "delete-local-data": deleteLocalData })
  }

  torrentAdd(args: {
    filename?: string
    metainfo?: string
    paused?: boolean
    "download-dir"?: string
    labels?: string[]
  }): Promise<{ "torrent-added"?: { id: number }; "torrent-duplicate"?: { id: number } }> {
    return this.call("torrent-add", args)
  }
}

export const rpc = new TransmissionClient(
  (import.meta.env.VITE_RPC_URL as string | undefined) ?? "../rpc",
)

// ---------------------------------------------------------------------------
// Torrent status / priorities
// https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md
// ---------------------------------------------------------------------------

export const Status = {
  stopped: 0,
  queuedToVerify: 1,
  verifying: 2,
  queuedToDownload: 3,
  downloading: 4,
  queuedToSeed: 5,
  seeding: 6,
} as const

export type StatusType = (typeof Status)[keyof typeof Status]

export const StatusStrings = [
  "Stopped",
  "Waiting",
  "Verifying",
  "Waiting",
  "Downloading",
  "Waiting",
  "Seeding",
] as const

export type PriorityNumberType = -1 | 0 | 1

export const BandwidthPriority = {
  low: -1,
  normal: 0,
  high: 1,
} as const

export const PriorityStrings: Record<PriorityNumberType, string> = {
  [-1]: "Low",
  0: "Normal",
  1: "High",
}

export type TorrentActionMethod =
  | "torrent-start"
  | "torrent-start-now"
  | "torrent-stop"
  | "torrent-verify"
  | "torrent-reannounce"
  | "queue-move-top"
  | "queue-move-up"
  | "queue-move-down"
  | "queue-move-bottom"

// ---------------------------------------------------------------------------
// Torrent fields
// ---------------------------------------------------------------------------

export const TorrentMinimumFields = [
  "id",
  "name",
  "status",
  "pieceCount",
  "downloadDir",
  "labels",
  "error",
  "errorString",
  "trackerStats",
  "magnetLink",
  "rateDownload",
  "rateUpload",
  "sizeWhenDone",
  "haveValid",
] as const

export const TorrentFields = [
  ...TorrentMinimumFields,
  "activityDate",
  "addedDate",
  "bandwidthPriority",
  "corruptEver",
  "comment",
  "creator",
  "dateCreated",
  "desiredAvailable",
  "doneDate",
  "downloadedEver",
  "downloadLimited",
  "downloadLimit",
  "editDate",
  "eta",
  "file-count",
  "group",
  "hashString",
  "haveUnchecked",
  "isFinished",
  "isPrivate",
  "isStalled",
  "leftUntilDone",
  "maxConnectedPeers",
  "metadataPercentComplete",
  "peersConnected",
  "peersGettingFromUs",
  "peersSendingToUs",
  "percentComplete",
  "percentDone",
  "pieceSize",
  "queuePosition",
  "recheckProgress",
  "secondsDownloading",
  "secondsSeeding",
  "sequential_download",
  "startDate",
  "totalSize",
  "uploadLimit",
  "uploadLimited",
  "uploadedEver",
  "uploadRatio",
] as const

export type TorrentFieldsType = (typeof TorrentFields)[number]

export interface Peer {
  address: string
  clientName?: string
  flagStr?: string
  progress?: number
  rateToClient?: number
  rateToPeer?: number
  port?: number
  isEncrypted?: boolean
  isUTP?: boolean
  isIncoming?: boolean
}

export interface TrackerStats {
  id?: number
  host?: string
  announce?: string
  scrape?: string
  seederCount?: number
  leecherCount?: number
  downloadCount?: number
  announceState?: number
  hasAnnounced?: boolean
  lastAnnounceResult?: string
  lastAnnounceSucceeded?: boolean
  lastAnnounceTime?: number
  lastScrapeResult?: string
  lastScrapeSucceeded?: boolean
  nextAnnounceTime?: number
}

export function trackerNextUpdateText(stats: TrackerStats | undefined): string {
  if (stats === undefined || stats.announceState !== 1) return "-"
  const remaining = (stats.nextAnnounceTime ?? 0) - Date.now() / 1000
  if (remaining <= 0) return "-"
  return formatDuration(remaining)
}

export interface Torrent {
  id: number
  name: string
  status: StatusType
  error: number
  errorString: string
  downloadDir: string
  labels: string[]
  hashString: string
  magnetLink: string
  rateDownload: number
  rateUpload: number
  sizeWhenDone: number
  haveValid: number
  totalSize: number
  leftUntilDone: number
  downloadedEver: number
  uploadedEver: number
  uploadRatio: number
  percentDone: number
  percentComplete: number
  eta: number
  addedDate: number
  doneDate: number
  activityDate: number
  startDate: number
  peersSendingToUs: number
  peersGettingFromUs: number
  peersConnected: number
  queuePosition: number
  bandwidthPriority: PriorityNumberType
  pieceCount: number
  pieceSize: number
  "file-count": number
  secondsSeeding: number
  secondsDownloading: number
  corruptEver: number
  dateCreated: number
  creator?: string
  comment?: string
  downloadLimited?: boolean
  downloadLimit?: number
  uploadLimited?: boolean
  uploadLimit?: number
  maxConnectedPeers?: number
  isPrivate: boolean
  isFinished: boolean
  isStalled: boolean
  metadataPercentComplete: number
  group: string
  sequential_download?: boolean
  trackerStats: TrackerStats[]
}
