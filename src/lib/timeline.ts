import type { Divergence } from '../store/worldStore';

export interface TimelineStep {
  /** Simulated year this bucket represents. */
  year: number;
  /** Divergences published in this sim-year, most-diverged first. */
  items: Divergence[];
  /** Sum of absolute deltas across the bucket — "how much moved" this year. */
  magnitude: number;
}

/** Absolute-sum of a divergence's delta — proxy for how far it moved reality. */
export function divergenceMagnitude(d: Divergence): number {
  return Object.values(d.delta).reduce((acc, v) => acc + Math.abs(v), 0);
}

/**
 * Group divergences into one bucket per simulated year, ascending, so a scrubber
 * can step through the fork's history. Years with no divergences are omitted
 * (the timeline only has steps where something actually happened). Within a
 * bucket, items are ordered by magnitude so the headline change surfaces first.
 */
export function buildTimeline(divs: Divergence[]): TimelineStep[] {
  const byYear = new Map<number, Divergence[]>();
  for (const d of divs) {
    const arr = byYear.get(d.sim_year);
    if (arr) arr.push(d);
    else byYear.set(d.sim_year, [d]);
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, items]) => {
      const sorted = [...items].sort((a, b) => divergenceMagnitude(b) - divergenceMagnitude(a));
      const magnitude = sorted.reduce((acc, d) => acc + divergenceMagnitude(d), 0);
      return { year, items: sorted, magnitude };
    });
}

/** Cumulative magnitude across every step up to and including `index`. */
export function cumulativeMagnitude(steps: TimelineStep[], index: number): number {
  return steps.slice(0, index + 1).reduce((acc, s) => acc + s.magnitude, 0);
}
