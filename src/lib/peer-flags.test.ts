import { describe, expect, it } from "vitest"
import { flagsTooltip } from "@/lib/peer-flags"

describe("flagsTooltip", () => {
  it("decodes a full flag string into grouped lines", () => {
    const out = flagsTooltip("TDdUuXEHhI")
    const lines = out.split("\n")
    expect(lines[0]).toBe("TDdUuXEHhI")
    expect(lines[1]).toBe("Status: downloading, can download from, uploading, can upload to")
    expect(lines).toContain("Encryption: encrypted")
    expect(lines).toContain("Protocol: µTP")
    expect(lines).toContain("Source: PEX + DHT")
    expect(lines).toContain("Connection: incoming")
    expect(lines).toContain("Holepunch: active")
  })

  it("falls back to idle/plain/tcp/tracker/outgoing for empty flags", () => {
    const out = flagsTooltip("")
    expect(out).toContain("Status: idle")
    expect(out).toContain("Encryption: plain text")
    expect(out).toContain("Protocol: TCP")
    expect(out).toContain("Source: tracker")
    expect(out).toContain("Connection: outgoing")
    expect(out).not.toContain("Holepunch")
  })

  it("handles undefined flags", () => {
    expect(flagsTooltip(undefined)).toContain("Status: idle")
  })

  it("lists optimistic unchoke and not-interested states", () => {
    const out = flagsTooltip("OK?")
    expect(out).toContain("optimistic unchoke")
    expect(out).toContain("not interested")
    expect(out).toContain("peer not interested")
  })
})
