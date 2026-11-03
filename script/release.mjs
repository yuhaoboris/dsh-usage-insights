#!/usr/bin/env node
/**
 * Tag-driven release for dsh-usage-insights.
 *
 *   node script/release.mjs                release the version already in package.json
 *   node script/release.mjs patch          bump patch (also: minor, major, or an explicit 1.2.0)
 *   node script/release.mjs --dry-run      print the plan and change nothing
 *
 * The script checks the working tree is clean and on `master`, promotes the `## Unreleased`
 * section of CHANGELOG.md into a dated `## vX.Y.Z` heading, bumps package.json, commits
 * `release: vX.Y.Z`, creates the annotated tag, pushes `master` plus the tag, and opens a
 * GitHub Release whose body is that changelog section.
 *
 * Deliberately small: no CI, no registry, no dependencies. The plugin is installed from this
 * directory, so a release is a tag plus notes.
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pkgPath = path.join(root, "package.json")
const changelogPath = path.join(root, "CHANGELOG.md")
const BRANCH = "master"

const argv = process.argv.slice(2)
const dryRun = argv.includes("--dry-run")
const bump = argv.find((arg) => !arg.startsWith("-")) ?? ""

function fail(message) {
  console.error(`release: ${message}`)
  process.exit(1)
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
}

function gitLive(...args) {
  execFileSync("git", args, { cwd: root, stdio: "inherit" })
}

function hasGh() {
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

const parse = (version) => version.split(".").map(Number)
const semver = /^\d+\.\d+\.\d+$/

function nextVersion(current, requested) {
  if (!requested) return current
  if (semver.test(requested)) {
    const [major, minor, patch] = parse(requested)
    const [curMajor, curMinor, curPatch] = parse(current)
    const newer =
      major > curMajor ||
      (major === curMajor && minor > curMinor) ||
      (major === curMajor && minor === curMinor && patch > curPatch)
    if (!newer) fail(`${requested} is not newer than the current ${current}`)
    return requested
  }
  if (!["patch", "minor", "major"].includes(requested)) {
    fail(`unknown bump "${requested}" (use patch, minor, major, or an explicit x.y.z)`)
  }
  const [major, minor, patch] = parse(current)
  if (requested === "major") return `${major + 1}.0.0`
  if (requested === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

// ---- Preconditions ---------------------------------------------------------------------------

const branch = git("rev-parse", "--abbrev-ref", "HEAD")
if (branch !== BRANCH) fail(`must run on ${BRANCH} (currently on ${branch})`)
if (git("status", "--porcelain") !== "") fail("working tree is not clean; commit or stash first")

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
const current = pkg.version
const version = nextVersion(current, bump)
const tag = `v${version}`

if (git("tag", "--list", tag) !== "") fail(`tag ${tag} already exists; releases are not moved`)
if (git("ls-remote", "--tags", "origin", `refs/tags/${tag}`) !== "") {
  fail(`tag ${tag} already exists on origin; releases are not moved`)
}

// ---- Promote the changelog section -----------------------------------------------------------

const source = readFileSync(changelogPath, "utf8").replace(/\r\n/g, "\n")
const lines = source.split("\n")
const start = lines.findIndex((line) => /^##\s+Unreleased\s*$/i.test(line))
if (start === -1) fail('CHANGELOG.md has no "## Unreleased" section')

let end = lines.findIndex((line, index) => index > start && /^##\s/.test(line))
if (end === -1) end = lines.length

const body = lines.slice(start + 1, end).join("\n").trim()
if (body === "" || /^nothing yet\.?$/i.test(body)) {
  fail('the "## Unreleased" section is empty; write the user-facing changes first')
}

const date = new Date().toISOString().slice(0, 10)
const promoted = [`## ${tag} — ${date}`, "", body]
const changelog = [
  ...lines.slice(0, start),
  "## Unreleased",
  "",
  "Nothing yet.",
  "",
  ...promoted,
  "",
  ...lines.slice(end),
]
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .replace(/\n*$/, "\n")

const nextPkg = { ...pkg, version }

// ---- Plan ------------------------------------------------------------------------------------

console.log(`release ${current} -> ${version}`)
console.log(`  tag      ${tag} (annotated)`)
console.log(`  commit   release: ${tag}`)
console.log(`  release  GitHub Release "${tag}" with the notes below`)
console.log(`\n${promoted.join("\n")}\n`)

if (dryRun) {
  console.log("dry run: nothing was written, committed, tagged or pushed")
  process.exit(0)
}

// ---- Apply -----------------------------------------------------------------------------------

writeFileSync(changelogPath, changelog)
if (version !== current) writeFileSync(pkgPath, `${JSON.stringify(nextPkg, null, 2)}\n`)

gitLive("add", "package.json", "CHANGELOG.md")
gitLive("commit", "-m", `release: ${tag}`)
gitLive("tag", "-a", tag, "-m", tag)
gitLive("push", "origin", `HEAD:refs/heads/${BRANCH}`)
gitLive("push", "origin", `refs/tags/${tag}`)

if (!hasGh()) {
  console.log(`\ngh is not installed; create the release by hand:\n  gh release create ${tag} --title ${tag} --notes-file <notes>`)
  process.exit(0)
}

const notesFile = path.join(mkdtempSync(path.join(tmpdir(), "release-")), "notes.md")
writeFileSync(notesFile, `${body}\n`)
execFileSync(
  "gh",
  ["release", "create", tag, "--title", tag, "--notes-file", notesFile, "--verify-tag"],
  { cwd: root, stdio: "inherit" },
)

console.log(`\nreleased https://github.com/${pkg.repository.url.replace(/^git\+|\.git$/g, "")}/releases/tag/${tag}`)
