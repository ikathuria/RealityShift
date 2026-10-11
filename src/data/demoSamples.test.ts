import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEMO_2026_MEDIA_ENTRIES } from './demoSamples'
import { inspectProvenance } from '../lib/provenance'

describe('DEMO_2026_MEDIA_ENTRIES', () => {
  // The Verify page hashes a dropped file's raw bytes with SHA-256 and looks
  // the result up by canonical_hash, so these must be the real file digests.
  it.each(DEMO_2026_MEDIA_ENTRIES.map(e => [e.b2_url, e] as const))('%s carries its real SHA-256', (url, entry) => {
    const bytes = readFileSync(join(process.cwd(), url))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.canonical_hash)
  })

  it('every sample is flagged as synthetic sample content', () => {
    for (const e of DEMO_2026_MEDIA_ENTRIES) {
      expect(e.provenance?.sample).toBe(true)
      expect(inspectProvenance({ provenance: e.provenance }).kind).toBe('sample')
    }
  })
})
