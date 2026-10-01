import { useEffect, useMemo, useRef, useState } from 'react';
import type { Divergence } from '../store/worldStore';
import { countryName } from '../data/countries';
import { buildTimeline, cumulativeMagnitude, divergenceMagnitude } from '../lib/timeline';

function magLabel(mag: number): string {
  return mag > 5 ? 'Big swing' : mag > 2 ? 'Noticeable' : 'Nudge';
}

/**
 * Interactive replay of a fork's divergence history. Scrub the slider (or hit
 * play) to step year-by-year through where the simulation drifted from reality,
 * with a running "how far from reality" meter. Falls back gracefully when there
 * is no timeline yet.
 */
export default function TimelineScrubber({ divs }: { divs: Divergence[] }) {
  const steps = useMemo(() => buildTimeline(divs), [divs]);
  const [rawIndex, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clamp during render so the index stays valid as the data changes, without
  // a state-syncing effect.
  const index = steps.length === 0 ? 0 : Math.min(rawIndex, steps.length - 1);

  // Auto-advance while playing; stop (and reset play state) at the last step.
  useEffect(() => {
    if (!playing || steps.length === 0) return;
    timer.current = setInterval(() => {
      setIndex(i => {
        if (i >= steps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1100);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, steps.length]);

  if (steps.length === 0) {
    return (
      <p style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-sm)', textAlign: 'center', padding: 'var(--rs-space-5)', margin: 0 }}>
        Nothing has drifted yet. Simulate a year and this timeline fills in as the world drifts from reality.
      </p>
    );
  }

  const step = steps[index];
  const totalMag = cumulativeMagnitude(steps, steps.length - 1);
  const runningMag = cumulativeMagnitude(steps, index);
  const pct = totalMag > 0 ? (runningMag / totalMag) * 100 : 0;
  const atEnd = index >= steps.length - 1;

  const togglePlay = () => {
    if (atEnd) setIndex(0);
    setPlaying(p => !p);
  };

  return (
    <div>
      {/* Transport + year readout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-space-3)', marginBottom: 'var(--rs-space-3)' }}>
        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
          className="game-button"
          style={{ width: 48, padding: 0, flexShrink: 0 }}
        >
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-space-2)', flexWrap: 'wrap' }}>
            <span className="game-font-display" style={{ fontSize: 'var(--rs-text-xl)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {step.year}
            </span>
            <span className="game-badge rs-chip-fork">Fork</span>
          </div>
          <div style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-xs)', marginTop: 'var(--rs-space-1)' }}>
            Step {index + 1} of {steps.length} · {step.items.length} divergence{step.items.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={index}
        aria-label="Scrub timeline by year"
        onChange={e => {
          setPlaying(false);
          setIndex(Number(e.target.value));
        }}
        style={{ width: '100%', minHeight: 44, accentColor: 'var(--rs-fork)', cursor: 'pointer' }}
      />

      {/* Drift-from-reality meter */}
      <div style={{ margin: 'var(--rs-space-2) 0 var(--rs-space-4)' }}>
        <div className="game-eyebrow" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--rs-space-2)' }}>
          <span>DRIFT FROM REALITY</span>
          <span style={{ fontFamily: 'var(--rs-font-mono)', fontVariantNumeric: 'tabular-nums' }}>{runningMag.toFixed(1)}</span>
        </div>
        <div
          className="rs-drift"
          role="meter"
          aria-label="Drift from reality"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={`${Math.round(pct)}% of this fork's total drift`}
          style={{ display: 'block' }}
        >
          <i style={{ left: `${pct}%` }} />
        </div>
      </div>

      {/* Divergences for the active year */}
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-space-2)', listStyle: 'none', margin: 0, padding: 0 }}>
        {step.items.slice(0, 8).map(d => {
          const mag = divergenceMagnitude(d);
          return (
            <li key={d.id} className="game-card" style={{ borderLeft: '6px solid var(--rs-fork)' }}>
              <div style={{ display: 'flex', gap: 'var(--rs-space-2)', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="game-font-display" style={{ fontSize: 'var(--rs-text-md)', margin: 0 }}>
                  {countryName(d.country_code)}
                </h3>
                <span className="rs-pill rs-pill-fork" title={magLabel(mag)}>
                  Δ {mag.toFixed(1)}<span className="rs-sr-only"> ({magLabel(mag)})</span>
                </span>
              </div>
              <p style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-xs)', margin: 'var(--rs-space-1) 0 0', lineHeight: 1.45 }}>
                {d.narrative.split('\n\nNews used:')[0].slice(0, 140)}…
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
