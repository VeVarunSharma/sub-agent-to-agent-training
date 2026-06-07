import { createHash } from "node:crypto"
import { chmodSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as age from "age-encryption"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { parseAgeIdentityFromFile, sealJsonl, unsealJsonl } from "../src/seal/index.js"
import { createFixtureRoot } from "./fixtures/builders.js"

interface FixtureRecord {
  case_id: string
  split: string
  value: number
}

interface IdentityFixture {
  path: string
  identity: string
  recipient: string
}

let root = ""
const roots = new Set<string>()

beforeEach(() => {
  root = createFixtureRoot("srs-seal-")
  roots.add(root)
})

afterEach(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
  roots.clear()
  root = ""
})

describe("age sealing", () => {
  it("roundtrips a JSONL fixture and preserves the plaintext sha256", async () => {
    const keys = await writeIdentity("holdout.age.key")
    const records: FixtureRecord[] = [
      { case_id: "van-ssmuh-holdout-001", split: "holdout", value: 1 },
      { case_id: "van-ssmuh-holdout-002", split: "holdout", value: 2 },
    ]
    const plaintextPath = writeJsonl("fixture.jsonl", records)
    const expectedSha = prefixedSha256(records.map((record) => JSON.stringify(record)).join("\n") + "\n")

    const sealed = await sealJsonl(plaintextPath, keys.recipient)
    const unsealed = await unsealJsonl<FixtureRecord>(sealed.ciphertextPath, keys.identity)

    expect(sealed.plaintextSha256).toBe(expectedSha)
    expect(unsealed.plaintextSha256).toBe(expectedSha)
    expect(unsealed.records).toEqual(records)
  })

  it("refuses to overwrite an existing ciphertext without overwrite true", async () => {
    const keys = await writeIdentity("holdout.age.key")
    const plaintextPath = writeJsonl("fixture.jsonl", [{ case_id: "van-ssmuh-holdout-001", split: "holdout", value: 1 }])

    await sealJsonl(plaintextPath, keys.recipient)

    await expect(sealJsonl(plaintextPath, keys.recipient)).rejects.toThrow(/refusing to overwrite/)
  })

  it("parses an age identity file and returns the matching recipient", async () => {
    const keys = await writeIdentity("holdout.age.key")

    await expect(parseAgeIdentityFromFile(keys.path)).resolves.toEqual({
      identity: keys.identity,
      recipient: keys.recipient,
    })
  })

  it("throws when decrypting with the wrong identity", async () => {
    const keys = await writeIdentity("holdout.age.key")
    const wrongKeys = await writeIdentity("wrong.age.key")
    const plaintextPath = writeJsonl("fixture.jsonl", [{ case_id: "van-ssmuh-holdout-001", split: "holdout", value: 1 }])
    const sealed = await sealJsonl(plaintextPath, keys.recipient)

    await expect(unsealJsonl(sealed.ciphertextPath, wrongKeys.identity)).rejects.toThrow()
  })
})

async function writeIdentity(fileName: string): Promise<IdentityFixture> {
  const identity = await age.generateIdentity()
  const recipient = await age.identityToRecipient(identity)
  const path = join(root, fileName)
  writeFileSync(path, `# public key: ${recipient}\n${identity}\n`, { mode: 0o600 })
  chmodSync(path, 0o600)
  return { path, identity, recipient }
}

function writeJsonl(fileName: string, records: FixtureRecord[]): string {
  const path = join(root, fileName)
  writeFileSync(path, records.map((record) => JSON.stringify(record)).join("\n") + "\n")
  return path
}

function prefixedSha256(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`
}
