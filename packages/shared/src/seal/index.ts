import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, stat, writeFile } from "node:fs/promises"
import { TextDecoder } from "node:util"
import { Decrypter, Encrypter, identityToRecipient } from "age-encryption"

export interface SealResult {
  ciphertextPath: string
  plaintextSha256: string
  ciphertextSha256: string
  sealedAt: string
}

export interface UnsealResult<T = unknown> {
  records: T[]
  plaintextSha256: string
}

const textDecoder = new TextDecoder()

export async function sealJsonl(
  plaintextPath: string,
  ageRecipient: string,
  options: { overwrite?: boolean } = {},
): Promise<SealResult> {
  const ciphertextPath = `${plaintextPath}.age`
  if (existsSync(ciphertextPath) && options.overwrite !== true) {
    throw new Error(`refusing to overwrite existing ciphertext at ${ciphertextPath}`)
  }

  const plaintext = await readFile(plaintextPath)
  const plaintextSha256 = prefixedSha256(plaintext)
  const encrypter = new Encrypter()
  encrypter.addRecipient(ageRecipient)
  const ciphertext = await encrypter.encrypt(plaintext)
  await writeFile(ciphertextPath, ciphertext)
  const ciphertextBytes = await readFile(ciphertextPath)

  return {
    ciphertextPath,
    plaintextSha256,
    ciphertextSha256: prefixedSha256(ciphertextBytes),
    sealedAt: new Date().toISOString(),
  }
}

export async function unsealJsonl<T = unknown>(
  ciphertextPath: string,
  ageIdentity: string,
  options?: { allowPlaintextWrite?: false },
): Promise<UnsealResult<T>> {
  if (options && "allowPlaintextWrite" in options && options.allowPlaintextWrite !== false) {
    throw new Error("unsealJsonl does not support plaintext writes")
  }

  const ciphertext = await readFile(ciphertextPath)
  const decrypter = new Decrypter()
  decrypter.addIdentity(ageIdentity)
  const plaintext = await decrypter.decrypt(ciphertext)
  const text = textDecoder.decode(plaintext)
  const records = parseJsonl<T>(text, ciphertextPath)

  return {
    records,
    plaintextSha256: prefixedSha256(plaintext),
  }
}

export async function parseAgeIdentityFromFile(identityPath: string): Promise<{ identity: string; recipient: string }> {
  await assertPrivateFileMode(identityPath)
  const text = await readFile(identityPath, "utf8")
  const identity = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("AGE-SECRET-KEY-1") || line.startsWith("AGE-SECRET-KEY-PQ-1"))

  if (!identity) throw new Error(`no age identity found in ${identityPath}`)

  return {
    identity,
    recipient: await identityToRecipient(identity),
  }
}

function prefixedSha256(bytes: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

function parseJsonl<T>(text: string, sourcePath: string): T[] {
  const records: T[] = []
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    if (raw === undefined || raw.trim() === "") continue
    try {
      records.push(JSON.parse(raw) as T)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`failed to parse JSONL at ${sourcePath}:${index + 1}: ${message}`)
    }
  }
  return records
}

async function assertPrivateFileMode(identityPath: string): Promise<void> {
  const info = await stat(identityPath)
  const groupOrOtherBits = info.mode & 0o077
  if (groupOrOtherBits === 0) return

  const message = `age identity file must be chmod 600 or stricter: ${identityPath}`
  if (process.platform === "win32") {
    console.warn(`${message}. Continuing because POSIX mode checks are unreliable on Windows.`)
    return
  }
  throw new Error(message)
}
