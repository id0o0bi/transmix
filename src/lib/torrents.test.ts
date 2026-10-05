import { describe, expect, it } from "vitest"
import {
  defaultFilterState,
  parseFilterState,
  serializeFilterState,
} from "@/lib/torrents"

describe("filter state prefs", () => {
  it("round-trips through JSON with Sets intact", () => {
    const state = {
      status: new Set(["downloading", "stopped"]),
      labels: new Set(["foo"]),
      trackers: new Set(["tracker:https://t.example/announce"]),
      dirs: new Set(["/downloads"]),
    }
    const revived = parseFilterState(JSON.parse(JSON.stringify(serializeFilterState(state))))
    expect(revived.status).toEqual(state.status)
    expect(revived.labels).toEqual(state.labels)
    expect(revived.trackers).toEqual(state.trackers)
    expect(revived.dirs).toEqual(state.dirs)
  })

  it("recovers from the legacy Set→{} shape", () => {
    const legacy = JSON.parse(
      JSON.stringify({
        status: new Set(["downloading"]),
        labels: new Set(["foo"]),
        trackers: new Set(),
        dirs: new Set(),
      }),
    )
    expect(legacy.status).toEqual({})
    const revived = parseFilterState(legacy)
    expect(revived.status).toBeInstanceOf(Set)
    expect(revived.status.has("all")).toBe(true)
    expect(revived.labels).toBeInstanceOf(Set)
    expect(revived.trackers).toBeInstanceOf(Set)
    expect(revived.dirs).toBeInstanceOf(Set)
  })

  it("falls back to defaults for missing or corrupt values", () => {
    expect(parseFilterState(null)).toEqual(defaultFilterState())
    expect(parseFilterState(undefined)).toEqual(defaultFilterState())
    expect(parseFilterState("junk")).toEqual(defaultFilterState())
    expect(parseFilterState({ status: 42, labels: "x" })).toEqual(defaultFilterState())
    expect(parseFilterState({ status: [1, null, "ok"] }).status).toEqual(new Set(["ok"]))
  })
})
