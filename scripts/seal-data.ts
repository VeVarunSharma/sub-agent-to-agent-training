#!/usr/bin/env -S node --experimental-strip-types

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseAgeIdentityFromFile, sealJsonl, unsealJsonl } from "../packages/shared/src/seal/index.ts"

interface Args {
  domain?: string
  identity: string
  keepPlaintext: boolean
  dryRun: boolean
  force: boolean
}

interface ReceiptFile {
  path: string
  ciphertext_path: string
  plaintext_sha256: string
  ciphertext_sha256: string
  sealed_at: string
}

interface SealReceipt {
  domain: string
  identity_public_key: string
  sealed_files: ReceiptFile[]
}

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..")
const defaultIdentity = "~/.config/srs/holdout.age.key"
const splitNames = ["holdout", "gold-holdout"] as const

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.domain) exitWithUsage("--domain is required")
  const domain = args.domain
  const identityPath = expandHome(args.identity)

  if (!existsSync(identityPath)) {
    const message = `identity not found at ${identityPath}; pass --identity=<path> or generate one with \`age-keygen\``
    console.log(message)
    if (args.dryRun) return
    process.exit(2)
  }

  const identity = await parseAgeIdentityFromFile(identityPath)
  const receiptPath = join(repoRoot, "datasets/cases", `seal-receipt.${domain}.json`)
  const previousReceipt = readReceipt(receiptPath)
  const targets = splitNames.map((split) => buildTarget(domain, split))

  if (await isAlreadySealed(targets, previousReceipt, identity.recipient)) {
    console.log("already sealed")
    return
  }

  const sealedFiles: ReceiptFile[] = []
  let processed = 0
  for (const target of targets) {
    const plaintextExists = existsSync(target.plaintextPath)
    const ciphertextExists = existsSync(target.ciphertextPath)
    if (!plaintextExists) {
      if (ciphertextExists) {
        const previous = previousReceipt?.sealed_files.find((file) => file.path === target.relativePlaintext)
        if (previous) sealedFiles.push(previous)
        else console.warn(`warning: ${target.relativeCiphertext} exists but ${target.relativePlaintext} is missing`)
      }
      continue
    }

    processed += 1
    const plaintextSha256 = await hashFile(target.plaintextPath)
    const previous = previousReceipt?.sealed_files.find((file) => file.path === target.relativePlaintext)
    const existingCiphertextSha256 = ciphertextExists ? await hashFile(target.ciphertextPath) : null
    const canReuseExisting = Boolean(
      previous &&
        ciphertextExists &&
        previous.plaintext_sha256 === plaintextSha256 &&
        previous.ciphertext_sha256 === existingCiphertextSha256,
    )

    if (args.dryRun) {
      console.log(`would seal ${target.relativePlaintext}`)
      continue
    }

    let receiptFile: ReceiptFile
    if (canReuseExisting && previous) {
      await verifyCiphertext(target.ciphertextPath, identity.identity, plaintextSha256)
      receiptFile = previous
    } else {
      if (ciphertextExists && !args.force) {
        throw new Error(`refusing to overwrite ${target.relativeCiphertext}. Pass --force to reseal.`)
      }
      const result = await sealJsonl(target.plaintextPath, identity.recipient, { overwrite: args.force })
      await verifyCiphertext(result.ciphertextPath, identity.identity, plaintextSha256)
      receiptFile = {
        path: target.relativePlaintext,
        ciphertext_path: target.relativeCiphertext,
        plaintext_sha256: result.plaintextSha256,
        ciphertext_sha256: result.ciphertextSha256,
        sealed_at: result.sealedAt,
      }
    }

    if (!args.keepPlaintext) await rm(target.plaintextPath)
    sealedFiles.push(receiptFile)
  }

  if (args.dryRun) {
    if (processed === 0) console.log(`no plaintext holdout files found for domain ${domain}`)
    return
  }

  if (processed === 0 && sealedFiles.length === 0) {
    console.log(`no plaintext holdout files found for domain ${domain}`)
    return
  }

  const receipt: SealReceipt = {
    domain,
    identity_public_key: identity.recipient,
    sealed_files: targets
      .map((target) => sealedFiles.find((file) => file.path === target.relativePlaintext))
      .filter((file): file is ReceiptFile => file !== undefined),
  }
  await mkdir(dirname(receiptPath), { recursive: true })
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(`sealed ${processed} file(s) for domain ${domain}`)
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    identity: defaultIdentity,
    keepPlaintext: false,
    dryRun: false,
    force: false,
  }

  for (const arg of argv) {
    if (arg === "--keep-plaintext") {
      args.keepPlaintext = true
      continue
    }
    if (arg === "--dry-run") {
      args.dryRun = true
      continue
    }
    if (arg === "--force") {
      args.force = true
      continue
    }
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (!match || !match[1]) exitWithUsage(`unknown argument '${arg}'`)
    const key = match[1]
    const value = match[2] ?? ""
    if (key === "domain") args.domain = value
    else if (key === "identity") args.identity = value
    else exitWithUsage(`unknown argument '--${key}'`)
  }

  return args
}

function buildTarget(domain: string, split: (typeof splitNames)[number]) {
  const plaintextPath = join(repoRoot, "datasets/cases", `${domain}.${split}.jsonl`)
  const ciphertextPath = `${plaintextPath}.age`
  return {
    plaintextPath,
    ciphertextPath,
    relativePlaintext: toRepoPath(plaintextPath),
    relativeCiphertext: toRepoPath(ciphertextPath),
  }
}

async function isAlreadySealed(
  targets: ReturnType<typeof buildTarget>[],
  receipt: SealReceipt | null,
  recipient: string,
): Promise<boolean> {
  if (!receipt || receipt.identity_public_key !== recipient) return false
  for (const target of targets) {
    if (existsSync(target.plaintextPath)) return false
    const entry = receipt.sealed_files.find((file) => file.path === target.relativePlaintext)
    if (!entry) {
      if (existsSync(target.ciphertextPath)) return false
      continue
    }
    if (!existsSync(target.ciphertextPath) || entry.ciphertext_path !== target.relativeCiphertext) return false
    if ((await hashFile(target.ciphertextPath)) !== entry.ciphertext_sha256) return false
  }
  return true
}

async function verifyCiphertext(ciphertextPath: string, identity: string, expectedPlaintextSha256: string): Promise<void> {
  const unsealed = await unsealJsonl(ciphertextPath, identity)
  if (unsealed.plaintextSha256 !== expectedPlaintextSha256) {
    throw new Error(`round-trip sha256 mismatch for ${toRepoPath(ciphertextPath)}`)
  }
}

async function hashFile(path: string): Promise<string> {
  const bytes = await readFile(path)
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

function readReceipt(path: string): SealReceipt | null {
  if (!existsSync(path)) return null
  const parsed = JSON.parse(readFileSyncText(path)) as unknown
  if (!isReceipt(parsed)) throw new Error(`invalid seal receipt at ${toRepoPath(path)}`)
  return parsed
}

function readFileSyncText(path: string): string {
  return readFileSync(path, "utf8")
}

function isReceipt(value: unknown): value is SealReceipt {
  if (!isObject(value)) return false
  if (typeof value.domain !== "string" || typeof value.identity_public_key !== "string") return false
  if (!Array.isArray(value.sealed_files)) return false
  return value.sealed_files.every(isReceiptFile)
}

function isReceiptFile(value: unknown): value is ReceiptFile {
  if (!isObject(value)) return false
  return typeof value.path === "string" &&
    typeof value.ciphertext_path === "string" &&
    typeof value.plaintext_sha256 === "string" &&
    typeof value.ciphertext_sha256 === "string" &&
    typeof value.sealed_at === "string"
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function expandHome(path: string): string {
  if (path === "~") return homedir()
  if (path.startsWith("~/")) return join(homedir(), path.slice(2))
  return resolve(path)
}

function toRepoPath(path: string): string {
  return relative(repoRoot, path).split("\\").join("/")
}

function exitWithUsage(message: string): never {
  console.error(message)
  process.exit(1)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
