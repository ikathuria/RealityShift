import { useRegionStore, REGION_POLICY_DEFAULTS } from '../store/regionStore';
import { useGameStore } from '../store/gameStore';
import { useWorldStore } from '../store/worldStore';

interface SliderCfg {
  key:   keyof typeof REGION_POLICY_DEFAULTS;
  label: string;
  min:   number;
  max:   number;
  step:  number;
  unit:  string;
  desc:  string;
}

const SLIDERS: SliderCfg[] = [
  {
    key: 'housing', label: 'Housing policy', min: 0, max: 10, step: 0.5, unit: '/10',
    desc: 'How tight rent control and zoning are',
  },
  {
    key: 'transport', label: 'Transit funding', min: 0, max: 10, step: 0.5, unit: '/10',
    desc: 'Money for buses, trains and trams',
  },
  {
    key: 'local_tax', label: 'Local tax rate', min: 5, max: 40, step: 1, unit: '%',
    desc: 'What the city takes from each paycheck',
  },
];

function formatPop(pop: number | null): string {
  if (pop === null) return '—';
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000)     return `${(pop / 1_000).toFixed(0)}K`;
  return `${pop}`;
}

export default function RegionPanel() {
  const { selectedRegion, regionStates, regionDraft, setRegionDraft, saveRegionPolicy, selectRegion } = useRegionStore();
  const { activeFork } = useGameStore();
  const { activeWorldId } = useWorldStore();

  if (!selectedRegion) return null;

  const worldId  = activeFork?.worldId ?? activeWorldId;
  const key      = `${worldId}:${selectedRegion.code}`;
  const existing = regionStates[key];
  const base     = existing?.policies ?? REGION_POLICY_DEFAULTS;

  const val = (k: keyof typeof REGION_POLICY_DEFAULTS): number =>
    regionDraft[k] !== undefined ? regionDraft[k]! : base[k];

  const isInFork = !!activeFork;
  const hasDraft = Object.keys(regionDraft).length > 0;

  return (
    <section aria-label={`${selectedRegion.name} region`} className="rs-paper" style={{
      position: 'absolute',
      top:      'var(--rs-space-4)',
      right:    'var(--rs-space-4)',
      width:    300,
      maxWidth: 'calc(100% - 2 * var(--rs-space-4))',
      zIndex:   30,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: 'var(--rs-space-4) var(--rs-space-4) var(--rs-space-3)', borderBottom: 'var(--rs-border-thin)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--rs-space-2)' }}>
          <div>
            <div className="game-eyebrow" style={{ marginBottom: 'var(--rs-space-1)' }}>Region</div>
            <h2 className="game-font-display" style={{ fontSize: 'var(--rs-text-xl)', lineHeight: 1.05, margin: 0 }}>
              {selectedRegion.name}
            </h2>
            <div style={{ marginTop: 'var(--rs-space-2)', display: 'flex', gap: 'var(--rs-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="game-badge">{selectedRegion.countryCode}</span>
              {isInFork && <span className="game-badge rs-chip-fork">Your fork</span>}
              {existing?.population !== undefined && (
                <span style={{ fontSize: 'var(--rs-text-xs)', color: 'var(--rs-muted-on-paper)', fontWeight: 700 }}>
                  Pop. {formatPop(existing.population)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => selectRegion(null)}
            aria-label={`Close ${selectedRegion.name}`}
            className="game-button game-button-dark"
            style={{ width: 44, padding: 0, flexShrink: 0 }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      {/* Policy sliders */}
      <div style={{ padding: 'var(--rs-space-4)' }}>
        <h3 className="game-eyebrow" style={{ margin: '0 0 var(--rs-space-3)' }}>Local policies</h3>

        {SLIDERS.map(cfg => {
          const current = val(cfg.key);
          const digits  = cfg.step < 1 ? 1 : 0;
          const delta   = current - base[cfg.key];
          const deltaStr = delta === 0 ? '' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(digits)}`;
          const deltaColor = delta > 0 ? 'var(--rs-good)' : 'var(--rs-bad)';
          const inputId = `region-${cfg.key}`;

          return (
            <div key={cfg.key} style={{ marginBottom: 'var(--rs-space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--rs-space-2)', marginBottom: 'var(--rs-space-1)' }}>
                <div>
                  <label htmlFor={inputId} style={{ fontSize: 'var(--rs-text-sm)', fontWeight: 700 }}>{cfg.label}</label>
                  <div style={{ fontSize: 'var(--rs-text-2xs)', color: 'var(--rs-muted-on-paper)', marginTop: 1 }}>{cfg.desc}</div>
                </div>
                <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span className={`rs-pill ${isInFork ? 'rs-pill-fork' : 'rs-pill-real'}`}>
                    {current.toFixed(digits)}{cfg.unit}
                  </span>
                  {deltaStr && (
                    <span style={{ marginLeft: 'var(--rs-space-1)', color: deltaColor, fontSize: 'var(--rs-text-2xs)', fontWeight: 800, fontFamily: 'var(--rs-font-mono)' }}>{deltaStr}</span>
                  )}
                </span>
              </div>
              <input
                id={inputId}
                type="range"
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={current}
                onChange={e => setRegionDraft({ [cfg.key]: parseFloat(e.target.value) })}
                disabled={!isInFork}
                style={{ width: '100%', minHeight: 44, accentColor: 'var(--rs-fork)', opacity: isInFork ? 1 : 0.5 }}
              />
            </div>
          );
        })}

        {!isInFork && (
          <p style={{ fontSize: 'var(--rs-text-xs)', color: 'var(--rs-muted-on-paper)', margin: 'var(--rs-space-1) 0 var(--rs-space-2)', textAlign: 'center' }}>
            Reality is read-only. Take over a country to start meddling locally.
          </p>
        )}

        {isInFork && (
          <button
            onClick={() => saveRegionPolicy(worldId)}
            disabled={!hasDraft}
            className="game-button"
            style={{ width: '100%' }}
          >
            {hasDraft ? 'Save region policy' : 'Move a slider to save'}
          </button>
        )}
      </div>

      {/* Footer hint */}
      <p style={{
        margin: 0,
        padding: 'var(--rs-space-2) var(--rs-space-4) var(--rs-space-3)',
        borderTop: 'var(--rs-border-thin)',
        fontSize: 'var(--rs-text-xs)', color: 'var(--rs-muted-on-paper)', textAlign: 'center',
      }}>
        Local tweaks nudge what your national AI leader decides next.
      </p>
    </section>
  );
}
