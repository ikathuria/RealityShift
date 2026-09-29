import { describe, it, expect } from 'vitest'
import { sha256Hex, extractProvenance, inspectProvenance } from './provenance'

const good = {
  simulation: {
    fork_id: 'fork-abc',
    parent_fork_id: null,
    divergence_date: '2026-01-01',
    sim_date: '2026-06-01',
    real_world_data_cutoff: '2026-01-01',
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
    expect(fields?.real_world_data_cutoff).toBe('2026-01-01')
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

  it('fails when the cutoff does not equal the divergence date', () => {
    const report = inspectProvenance({
      simulation: { ...good.simulation, real_world_data_cutoff: '2026-03-01' },
    })
    expect(report.consistent).toBe(false)
    expect(report.checks.find(c => c.label === 'Cutoff equals divergence date')?.pass).toBe(false)
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

  it('fails when the reporting date precedes the cutoff', () => {
    const report = inspectProvenance({
      simulation: { ...good.simulation, sim_date: '2025-01-01' },
    })
    expect(report.checks.find(c => c.label === 'Reporting date is at/after the cutoff')?.pass).toBe(false)
  })
})
