export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`transmix.${key}`)
    if (raw !== null) return JSON.parse(raw) as T
  } catch {
    // corrupted or unavailable
  }
  return fallback
}

export function savePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`transmix.${key}`, JSON.stringify(value))
  } catch {
    // storage unavailable
  }
}
