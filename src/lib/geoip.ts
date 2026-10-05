import { loadPref, savePref } from "@/lib/prefs"

const CACHE_KEY = "peerGeoCache"
const POSITIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const NEGATIVE_TTL_MS = 60 * 60 * 1000
const MAX_ENTRIES = 1000
const MAX_CONCURRENT = 2
const FETCH_TIMEOUT_MS = 8000

interface GeoEntry {
  /** Country code when known; absent = failed/unknown lookup (negative cache). */
  c?: string
  t: number
}

type GeoCache = Record<string, GeoEntry>

function isFresh(entry: GeoEntry, now: number): boolean {
  const ttl = entry.c !== undefined ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS
  return now - entry.t < ttl
}

function loadCache(): GeoCache {
  try {
    const raw = localStorage.getItem(`transmix.${CACHE_KEY}`)
    if (raw === null) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
    const now = Date.now()
    const items = Object.entries(parsed as Record<string, unknown>).filter(
      (pair): pair is [string, GeoEntry] => {
        const e = pair[1]
        return (
          typeof e === "object" &&
          e !== null &&
          typeof (e as GeoEntry).t === "number" &&
          ((e as GeoEntry).c === undefined || typeof (e as GeoEntry).c === "string") &&
          isFresh(e as GeoEntry, now)
        )
      },
    )
    items.sort((a, b) => b[1].t - a[1].t)
    const out: GeoCache = {}
    for (const [ip, entry] of items.slice(0, MAX_ENTRIES)) out[ip] = entry
    return out
  } catch {
    return {}
  }
}

const cache: GeoCache = loadCache()

let saveTimer: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  try {
    savePref(CACHE_KEY, cache)
  } catch {
    // storage unavailable
  }
}

function persist(): void {
  if (saveTimer !== null) clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 400)
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush)
}

export function isPeerGeoEnabled(): boolean {
  return loadPref<boolean>("peerCountryLookup", false)
}

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase()
    return (
      l === "::" ||
      l === "::1" ||
      l.startsWith("fc") ||
      l.startsWith("fd") ||
      (l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb"))
    )
  }
  const parts = ip.split(".").map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true
  const [a, b] = parts
  if (a === 10 || a === 127) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

export function flagEmoji(cc: string | null | undefined): string {
  if (cc === null || cc === undefined || !/^[a-z]{2}$/i.test(cc)) return ""
  const u = cc.toUpperCase()
  return String.fromCodePoint(
    0x1f1e6 + (u.charCodeAt(0) - 65),
    0x1f1e6 + (u.charCodeAt(1) - 65),
  )
}

function freshEntry(ip: string): GeoEntry | null {
  const entry = cache[ip]
  if (entry === undefined) return null
  if (!isFresh(entry, Date.now())) {
    delete cache[ip]
    return null
  }
  return entry
}

/** Synchronous cache lookup: country code or null (unknown / not yet fetched / failed). */
export function countryFor(ip: string): string | null {
  return freshEntry(ip)?.c ?? null
}

let active = 0
const queue: Array<() => void> = []
const inflight = new Map<string, Promise<void>>()

function pump(): void {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()
    if (job === undefined) break
    active += 1
    job()
  }
}

async function fetchCountry(ip: string): Promise<void> {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as { success?: boolean; country_code?: unknown }
    const cc = body.success !== false && typeof body.country_code === "string" ? body.country_code : undefined
    cache[ip] = cc !== undefined && /^[a-z]{2}$/i.test(cc) ? { c: cc, t: Date.now() } : { t: Date.now() }
  } catch {
    cache[ip] = { t: Date.now() }
  }
  persist()
}

/**
 * Queue lookups for the given IPs (private/unparseable and cached IPs are
 * skipped). Resolves when every queued lookup for this batch has settled.
 * No requests are made for IPs already in the (positive or negative) cache.
 */
export function ensureCountries(ips: string[]): Promise<void> {
  const jobs: Array<Promise<void>> = []
  for (const ip of new Set(ips)) {
    if (isPrivateIp(ip)) continue
    const running = inflight.get(ip)
    if (running !== undefined) {
      jobs.push(running)
      continue
    }
    if (freshEntry(ip) !== null) continue
    const job = new Promise<void>((resolve) => {
      queue.push(() => {
        void fetchCountry(ip).finally(() => {
          inflight.delete(ip)
          active -= 1
          resolve()
          pump()
        })
      })
    })
    inflight.set(ip, job)
    jobs.push(job)
  }
  pump()
  return Promise.all(jobs).then(() => undefined)
}
