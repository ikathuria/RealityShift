import { useEffect, useMemo, useRef, useState } from 'react';
import type { Divergence } from '../store/worldStore';
import { countryName } from '../data/countries';
import { buildTimeline, cumulativeMagnitude, divergenceMagnitude } from '../lib/timeline';

function magColor(mag: number): string {
  return mag > 5 ? 'var(--accent-magenta)' : mag > 2 ? 'var(--accent-yellow)' : 'var(--accent-green)';
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
      <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
        No divergences yet — this timeline fills in as the world drifts from reality.
      </div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
          className="game-font-heading"
          style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
            border: '2px solid var(--accent-cyan)', background: 'var(--surface-panel)',
            color: 'var(--accent-cyan)', fontSize: 16,
          }}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div style={{ flex: 1 }}>
          <div className="game-font-heading" style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-yellow)', lineHeight: 1 }}>
            {step.year}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
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
        style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
      />

      {/* Drift-from-reality meter */}
      <div style={{ margin: '10px 0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
          <span>DRIFT FROM REALITY</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{runningMag.toFixed(1)}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-panel)', overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: 'linear-gradient(90deg, var(--accent-green), var(--accent-yellow), var(--accent-magenta))',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Divergences for the active year */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {step.items.slice(0, 8).map(d => {
          const mag = divergenceMagnitude(d);
          return (
            <div key={d.id} className="game-card" style={{ position: 'relative', paddingLeft: 14 }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                background: magColor(mag), borderRadius: '4px 0 0 4px',
              }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="game-font-heading" style={{ fontWeight: 800, fontSize: 13, color: 'var(--accent-yellow)' }}>
                  {countryName(d.country_code)}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                  Δ {mag.toFixed(1)}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 11, margin: '4px 0 0', lineHeight: 1.45 }}>
                {d.narrative.split('\n\nNews used:')[0].slice(0, 140)}…
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
