// Trackers the torrent/magnet was first seen with, per infohash.
// Transmission does not expose the original announce list after
// `torrent-set {trackerList}` edits (even magnetLink is rebuilt from the
// mutated list), so we snapshot it on first sight and never overwrite.

const STORAGE_KEY = "transmix.originalTrackers"
const MAX_ENTRIES = 300

type OriginalMap = Record<string, string>

function load(): OriginalMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return {}
    return parsed as OriginalMap
  } catch {
    return {}
  }
}

function save(map: OriginalMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // storage unavailable
  }
}

/** The tracker list (trackerList format) this torrent was first seen with. */
export function getOriginalTrackers(hashString: string): string | null {
  if (hashString === "") return null
  const value = load()[hashString]
  return typeof value === "string" ? value : null
}

/** Snapshot the current list as the original; never overwrites an entry. */
export function seedOriginalTrackers(hashString: string, trackerList: string): void {
  if (hashString === "" || trackerList === "") return
  const map = load()
  if (map[hashString] !== undefined) return
  map[hashString] = trackerList
  const keys = Object.keys(map)
  if (keys.length > MAX_ENTRIES) {
    for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[key]
  }
  save(map)
}
