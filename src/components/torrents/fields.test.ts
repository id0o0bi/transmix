import { describe, expect, it } from "vitest"
import { compareFields, fieldsById } from "@/components/torrents/fields"
import type { CachedTorrent } from "@/lib/torrents"

function torrent(fields: Partial<CachedTorrent>): CachedTorrent {
  return fields as CachedTorrent
}

describe("compareFields", () => {
  const name = fieldsById.name
  const progress = fieldsById.progress

  it("sorts names ascending and descending", () => {
    const a = torrent({ name: "Alpha" })
    const b = torrent({ name: "beta" })
    expect(compareFields(a, b, name, false)).toBeLessThan(0)
    expect(compareFields(a, b, name, true)).toBeGreaterThan(0)
  })

  it("sorts names numerically so file2 < file10", () => {
    const a = torrent({ name: "file2.mkv" })
    const b = torrent({ name: "file10.mkv" })
    expect(compareFields(a, b, name, false)).toBeLessThan(0)
  })

  it("sorts numeric fields by value and flips with desc", () => {
    const a = torrent({ percentDone: 0.25 })
    const b = torrent({ percentDone: 0.75 })
    expect(compareFields(a, b, progress, false)).toBeLessThan(0)
    expect(compareFields(a, b, progress, true)).toBeGreaterThan(0)
  })

  it("returns 0 for equal values", () => {
    const a = torrent({ name: "same", percentDone: 0.5 })
    const b = torrent({ name: "same", percentDone: 0.5 })
    expect(compareFields(a, b, name, false)).toBe(0)
    expect(compareFields(a, b, progress, true)).toBeCloseTo(0)
  })
})
