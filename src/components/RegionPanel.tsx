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
    key: 'housing', label: 'Housing Policy', min: 0, max: 10, step: 0.5, unit: '/10',
    desc: 'Rent control & zoning strictness',
  },
  {
    key: 'transport', label: 'Transit Funding', min: 0, max: 10, step: 0.5, unit: '/10',
    desc: 'Public transport investment',
  },
  {
    key: 'local_tax', label: 'Local Tax Rate', min: 5, max: 40, step: 1, unit: '%',
    desc: 'Municipal revenue rate',
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
    <div style={{
      position:        'absolute',
      top:             16,
      right:           16,
      width:           300,
      background:      'rgba(10,10,20,0.93)',
      border:          '1px solid rgba(255,255,255,0.1)',
      borderRadius:    12,
      color:           '#fff',
      boxShadow:       '0 8px 32px rgba(0,0,0,0.6)',
      backdropFilter:  'blur(8px)',
      zIndex:          30,
      overflow:        'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>
              Region
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>
              {selectedRegion.name}
            </div>
            <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: 'rgba(99,102,241,0.2)', color: '#a78bfa',
                padding: '2px 7px', borderRadius: 4,
              }}>
                {selectedRegion.countryCode}
              </span>
              {existing?.population !== undefined && (
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  Pop. {formatPop(existing.population)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => selectRegion(null)}
            style={{
              background: 'none', border: 'none', color: '#6b7280',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Policy sliders */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Local Policies
        </div>

        {SLIDERS.map(cfg => {
          const current = val(cfg.key);
          const delta   = current - base[cfg.key];
          const deltaStr = delta === 0 ? '' :
            (delta > 0 ? `+${delta.toFixed(cfg.step < 1 ? 1 : 0)}` : delta.toFixed(cfg.step < 1 ? 1 : 0));
          const deltaColor = delta > 0 ? '#34d399' : delta < 0 ? '#f87171' : '#6b7280';

          return (
            <div key={cfg.key} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <div>
                  <span style={{ fontSize: 12, color: '#d1d5db' }}>{cfg.label}</span>
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>{cfg.desc}</div>
                </div>
                <span style={{ fontSize: 12, textAlign: 'right' }}>
                  <span style={{ fontWeight: 600 }}>
                    {current.toFixed(cfg.step < 1 ? 1 : 0)}
                  </span>
                  <span style={{ color: '#6b7280' }}>{cfg.unit}</span>
                  {deltaStr && (
                    <span style={{ marginLeft: 5, color: deltaColor, fontSize: 11 }}>{deltaStr}</span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={current}
                onChange={e => setRegionDraft({ [cfg.key]: parseFloat(e.target.value) })}
                disabled={!isInFork}
                style={{ width: '100%', accentColor: '#6366f1', opacity: isInFork ? 1 : 0.5 }}
              />
            </div>
          );
        })}

        {!isInFork && (
          <p style={{ fontSize: 11, color: '#4b5563', margin: '4px 0 8px', textAlign: 'center' }}>
            Take over a country to edit regional policies
          </p>
        )}

        {isInFork && (
          <button
            onClick={() => saveRegionPolicy(worldId)}
            disabled={!hasDraft}
            style={{
              width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
              background: hasDraft ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.06)',
              color: hasDraft ? '#fff' : '#4b5563',
              fontSize: 13, fontWeight: 600,
              cursor: hasDraft ? 'pointer' : 'default',
              transition: 'background 0.2s',
            }}
          >
            💾 Save Region Policy
          </button>
        )}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '8px 16px 12px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: 11, color: '#374151', textAlign: 'center',
      }}>
        Regional changes influence national agent decisions
      </div>
    </div>
  );
}
