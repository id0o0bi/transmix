import { describe, expect, it } from "vitest"
import { buildTree, dirPercent, filePercent, baseName } from "@/lib/file-tree"
import type { TorrentFileEntry } from "@/hooks/use-torrent-detail"

function entry(index: number, name: string, length: number, done: number, wanted = true): TorrentFileEntry {
  return { index, name, length, bytesCompleted: done, wanted, priority: 0 }
}

describe("buildTree", () => {
  const files = [
    entry(0, "a/b/c.txt", 100, 100),
    entry(1, "a/b/d.txt", 300, 0),
    entry(2, "e.txt", 50, 25),
  ]

  it("nests directories by path segments", () => {
    const roots = buildTree(files)
    const a = roots.find((r) => r.key === "a")
    expect(a).toBeDefined()
    expect(a?.level).toBe(0)
    expect(a?.dirs).toHaveLength(1)
    expect(a?.dirs[0].key).toBe("a/b")
    expect(a?.dirs[0].files.map((f) => f.name)).toEqual(["a/b/c.txt", "a/b/d.txt"])
  })

  it("keeps root-level files in a synthetic group", () => {
    const roots = buildTree(files)
    const rootFiles = roots.flatMap((r) => (r.level < 0 ? r.files : []))
    expect(rootFiles.map((f) => f.name)).toEqual(["e.txt"])
  })

  it("aggregates lengths, progress and indices up the tree", () => {
    const roots = buildTree(files)
    const a = roots.find((r) => r.key === "a")
    expect(a?.length).toBe(400)
    expect(a?.done).toBe(100)
    expect(a?.indices).toEqual([0, 1])
    expect(a?.wantedCount).toBe(2)
    const b = a?.dirs[0]
    expect(b?.length).toBe(400)
    expect(b?.done).toBe(100)
  })

  it("computes directory and file percentages", () => {
    const roots = buildTree(files)
    const a = roots.find((r) => r.key === "a")
    expect(dirPercent(a!)).toBeCloseTo(0.25, 10)
    expect(filePercent(files[0])).toBe(1)
    expect(filePercent(files[1])).toBe(0)
    expect(filePercent(entry(9, "zero", 0, 0))).toBe(1)
  })

  it("extracts the base name of a path", () => {
    expect(baseName("x/y/z.bin")).toBe("z.bin")
    expect(baseName("top.txt")).toBe("top.txt")
  })
})
