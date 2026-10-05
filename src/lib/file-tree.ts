import type { TorrentFileEntry } from "@/hooks/use-torrent-detail"

export interface DirNode {
  name: string
  key: string
  level: number
  dirs: DirNode[]
  files: TorrentFileEntry[]
  indices: number[]
  length: number
  done: number
  wantedCount: number
}

export function baseName(path: string): string {
  const i = path.lastIndexOf("/")
  return i === -1 ? path : path.slice(i + 1)
}

export function buildTree(files: TorrentFileEntry[]): DirNode[] {
  const roots: DirNode[] = []
  const byKey = new Map<string, DirNode>()
  const ensureDir = (list: DirNode[], name: string, key: string, level: number): DirNode => {
    let node = byKey.get(key)
    if (node === undefined) {
      node = { name, key, level, dirs: [], files: [], indices: [], length: 0, done: 0, wantedCount: 0 }
      byKey.set(key, node)
      list.push(node)
    }
    return node
  }
  for (const f of files) {
    const parts = f.name.split("/")
    let list = roots
    let key = ""
    for (let i = 0; i < parts.length - 1; i++) {
      key = key === "" ? parts[i] : `${key}/${parts[i]}`
      const node = ensureDir(list, parts[i], key, i)
      list = node.dirs
    }
    const parent = key === "" ? null : byKey.get(key)
    if (parent === null || parent === undefined) roots.push({ name: "", key: "", level: -1, dirs: [], files: [f], indices: [], length: 0, done: 0, wantedCount: 0 })
    else parent.files.push(f)
  }
  const aggregate = (node: DirNode) => {
    for (const f of node.files) {
      node.length += f.length
      node.done += f.bytesCompleted
      node.indices.push(f.index)
      if (f.wanted) node.wantedCount++
    }
    for (const d of node.dirs) {
      aggregate(d)
      node.length += d.length
      node.done += d.done
      node.indices.push(...d.indices)
      node.wantedCount += d.wantedCount
    }
  }
  const virtualRoots: DirNode[] = roots.filter((r) => r.level >= 0)
  // Root-level files are kept as a synthetic dir-less group; aggregate all real dirs.
  for (const r of virtualRoots) aggregate(r)
  return roots
}

export function dirPercent(d: DirNode): number {
  return d.length > 0 ? d.done / d.length : 1
}

/** Priority shared by every file under d, or null when mixed/empty. */
export function dirPriority(d: DirNode): number | null {
  let first: number | null = null
  let mixed = false
  const walk = (node: DirNode) => {
    for (const f of node.files) {
      if (first === null) first = f.priority
      else if (f.priority !== first) mixed = true
    }
    for (const child of node.dirs) walk(child)
  }
  walk(d)
  return mixed ? null : first
}

export function filePercent(f: TorrentFileEntry): number {
  return f.length > 0 ? f.bytesCompleted / f.length : 1
}
