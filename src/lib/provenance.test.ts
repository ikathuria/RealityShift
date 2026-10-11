import { describe, it, expect } from 'vitest'
import { sha256Hex, extractProvenance, inspectProvenance, formatCutoff, LIVE_CUTOFF_TEXT } from './provenance'

const good = {
  simulation: {
    fork_id: 'fork-abc',
    parent_fork_id: 'live',
    divergence_date: '2026-01-01',
    sim_date: '2028-11-05',
    real_world_data_cutoff: '2026-08-01T09:30:15.123Z',
    live_world: false,
    sample: false,
    nation_iso: 'USA',
    is_counterfactual: true,
    consensus_reality: false,
  },
  canonical_hash: 'deadbeef',
}

describe('sha256Hex', () => {
  it('computes the known SHA-256 of an empty input', async () => {
    const hex = await sha256Hex(new ArrayBuffer(0))
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('computes the known SHA-256 of "abc"', async () => {
    const hex = await sha256Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer)
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('extractProvenance', () => {
  it('reads a genblaze-style { simulation, canonical_hash } object', () => {
    const { fields, canonicalHash } = extractProvenance(good)
    expect(canonicalHash).toBe('deadbeef')
    expect(fields?.fork_id).toBe('fork-abc')
    expect(fields?.is_counterfactual).toBe(true)
  })

  it('reads a media-index entry with a nested provenance block', () => {
    const { fields } = extractProvenance({ provenance: good.simulation, canonical_hash: 'x' })
    expect(fields?.real_world_data_cutoff).toBe('2026-08-01T09:30:15.123Z')
  })

  it('reads a flat provenance object', () => {
    const { fields } = extractProvenance(good.simulation)
    expect(fields?.fork_id).toBe('fork-abc')
  })

  it('returns nulls for junk input', () => {
    expect(extractProvenance(null)).toEqual({ fields: null, canonicalHash: null })
    expect(extractProvenance(42)).toEqual({ fields: null, canonicalHash: null })
    expect(extractProvenance({ foo: 'bar' }).fields).toBeNull()
  })
})

describe('inspectProvenance', () => {
  it('passes every invariant for a well-formed forked asset', () => {
    const report = inspectProvenance(good)
    expect(report.consistent).toBe(true)
    expect(report.checks.every(c => c.pass)).toBe(true)
    expect(report.canonicalHash).toBe('deadbeef')
  })

  it('no longer requires the cutoff to equal the divergence date', () => {
    const report = inspectProvenance(good)
    expect(report.checks.some(c => /equals divergence/i.test(c.label))).toBe(false)
    expect(report.kind).toBe('fork')
  })

  it('fails a fork whose cutoff is a bare date or missing', () => {
    for (const cutoff of ['2026-08-01', null, 'yesterday']) {
      const report = inspectProvenance({ simulation: { ...good.simulation, real_world_data_cutoff: cutoff } })
      expect(report.consistent).toBe(false)
      expect(report.checks.find(c => c.label === 'Real-world data cutoff is a valid timestamp')?.pass).toBe(false)
    }
  })

  it('fails a fork whose cutoff precedes divergence', () => {
    const report = inspectProvenance({
      simulation: { ...good.simulation, real_world_data_cutoff: '2025-12-31T23:00:00.000Z' },
    })
    expect(report.checks.find(c => c.label === 'Cutoff is on/after the divergence date')?.pass).toBe(false)
  })

  it('accepts the live world with a null cutoff', () => {
    const report = inspectProvenance({
      simulation: {
        fork_id: 'live', parent_fork_id: null, divergence_date: '2026-01-01', sim_date: '2026-11-05',
        real_world_data_cutoff: null, live_world: true, sample: false, nation_iso: 'IND',
        is_counterfactual: false, consensus_reality: true,
      },
    })
    expect(report.kind).toBe('live')
    expect(report.consistent).toBe(true)
    expect(report.fields?.real_world_data_cutoff).toBeNull()
  })

  it('fails a live world that claims a cutoff', () => {
    const report = inspectProvenance({
      simulation: { fork_id: 'live', parent_fork_id: null, divergence_date: '2026-01-01', sim_date: '2026-11-05', real_world_data_cutoff: '2026-08-01T00:00:00.000Z', live_world: true },
    })
    expect(report.consistent).toBe(false)
  })

  it('flags sample content as synthetic', () => {
    const report = inspectProvenance({
      simulation: { ...good.simulation, fork_id: 'sample', parent_fork_id: null, sample: true, real_world_data_cutoff: null },
    })
    expect(report.kind).toBe('sample')
    expect(report.sample).toBe(true)
    expect(report.checks.find(c => /synthetic demo sample/i.test(c.label))).toBeTruthy()
  })

  it('fails when the asset is not marked counterfactual', () => {
    const report = inspectProvenance({ simulation: { ...good.simulation, is_counterfactual: false } })
    expect(report.consistent).toBe(false)
    expect(report.checks.find(c => c.label === 'Marked counterfactual')?.pass).toBe(false)
  })

  it('flags a missing provenance block', () => {
    const report = inspectProvenance({ nothing: true })
    expect(report.fields).toBeNull()
    expect(report.consistent).toBe(false)
  })

  it('fails when the reporting date precedes divergence', () => {
    const report = inspectProvenance({
      simulation: { ...good.simulation, sim_date: '2025-01-01' },
    })
    expect(report.checks.find(c => c.label === 'Reporting date is at/after divergence')?.pass).toBe(false)
  })
})

describe('formatCutoff', () => {
  it('describes the live world when the cutoff is null', () => {
    expect(formatCutoff(null, true)).toBe(LIVE_CUTOFF_TEXT)
  })

  it('formats a full timestamp in UTC', () => {
    expect(formatCutoff('2026-08-01T09:30:15.123Z')).toBe('1 Aug 2026, 09:30 UTC')
  })

  it('formats a bare date without a time', () => {
    expect(formatCutoff('2026-01-01')).toBe('1 Jan 2026')
  })
})
