#!/usr/bin/env node
/**
 * Build and publish a GitHub release for the current package.json version.
 *
 *   npm run release
 *
 * - refuses to run with a dirty working tree (assets must match the tagged commit)
 * - runs the production build (tsc + vite)
 * - packages dist/ into transmix-vX.Y.Z.tar.gz and transmix-vX.Y.Z.zip
 * - creates (or updates) the GitHub release vX.Y.Z with both archives attached
 *
 * Requires: gh (authenticated), git, tar, zip.
 */
import { execFileSync } from "node:child_process"
import { readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"))
const tag = `v${pkg.version}`
const tarName = `transmix-${tag}.tar.gz`
const zipName = `transmix-${tag}.zip`

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: root, stdio: "inherit", ...opts })

const out = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: root, encoding: "utf8", ...opts }).trim()

// 1. Working tree must be clean so the assets match the tagged commit.
const dirty = out("git", ["status", "--porcelain"])
if (dirty !== "") {
  console.error(`Working tree is dirty — commit (and push) first:\n${dirty}`)
  process.exit(1)
}

// 2. Build the production bundle (tsc -b && vite build).
console.log(`\n▸ Building ${tag}…`)
run("npm", ["run", "build"])

// 3. Package dist/ into versioned archives.
console.log(`\n▸ Packaging ${tarName} + ${zipName}…`)
const tarPath = path.join(root, tarName)
const zipPath = path.join(root, zipName)
rmSync(tarPath, { force: true })
rmSync(zipPath, { force: true })
run("tar", ["-czf", tarPath, "-C", "dist", "."])
run("zip", ["-qr", zipPath, "."], { cwd: path.join(root, "dist") })

// 4. Create or update the GitHub release.
const exists = (() => {
  try {
    execFileSync("gh", ["release", "view", tag], { cwd: root, stdio: "pipe" })
    return true
  } catch {
    return false
  }
})()

console.log(`\n▸ ${exists ? "Updating" : "Creating"} release ${tag}…`)
if (exists) {
  run("gh", ["release", "upload", tag, tarPath, zipPath, "--clobber"])
} else {
  run("gh", [
    "release",
    "create",
    tag,
    tarPath,
    zipPath,
    "--title",
    tag,
    "--generate-notes",
  ])
}

const url = out("gh", ["release", "view", tag, "--json", "url", "-q", ".url"])
console.log(`\n✓ Released ${tag}: ${url}`)
console.log(`  ${tarName}  ${zipName}`)
