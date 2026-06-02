import { cp, mkdir, rm, stat } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const distDir = resolve(root, "dist")
const docsDir = resolve(root, "docs")
const cnamePath = resolve(root, "CNAME")
const docsCnamePath = resolve(docsDir, "CNAME")

async function ensureDistExists() {
  try {
    const distStats = await stat(distDir)
    if (!distStats.isDirectory()) {
      throw new Error("dist exists but is not a directory")
    }
  } catch (error) {
    throw new Error("dist/ does not exist. Run npm run build first.", { cause: error })
  }
}

async function main() {
  await ensureDistExists()
  await rm(docsDir, { recursive: true, force: true })
  await mkdir(docsDir, { recursive: true })
  await cp(distDir, docsDir, { recursive: true })
  await cp(cnamePath, docsCnamePath)
  console.log("docs/ generated from dist/")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
