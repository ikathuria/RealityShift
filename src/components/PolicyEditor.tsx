import { useGameStore } from '../store/gameStore';

interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const INDICATOR_SLIDERS: SliderConfig[] = [
  { key: 'military_spend',   label: 'Military spend',   min: 0,  max: 20, step: 0.1, unit: '% GDP' },
  { key: 'education_spend',  label: 'Education spend',  min: 0,  max: 15, step: 0.1, unit: '% GDP' },
  { key: 'healthcare_spend', label: 'Healthcare spend', min: 0,  max: 20, step: 0.1, unit: '% GDP' },
  { key: 'tax_rate',         label: 'Tax revenue',      min: 5,  max: 60, step: 1,   unit: '% GDP' },
  { key: 'unemployment',     label: 'Unemployment',     min: 0,  max: 30, step: 0.5, unit: '%'     },
];

const POLICY_SLIDERS: SliderConfig[] = [
  { key: 'trade_openness', label: 'Trade openness', min: 0, max: 10, step: 0.5, unit: '/10' },
  { key: 'press_freedom',  label: 'Press freedom',  min: 0, max: 10, step: 0.5, unit: '/10' },
];

interface Props {
  baseIndicators: Record<string, number>;
  basePolicies: Record<string, unknown>;
}

function Slider({ cfg, base, value, onChange }: {
  cfg: SliderConfig;
  base: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const digits = cfg.step < 1 ? 1 : 0;
  const delta = value - base;
  const deltaStr = delta === 0 ? '' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(digits)}`;
  const deltaColor = delta > 0 ? 'var(--rs-good-on-dark)' : 'var(--rs-bad-on-dark)';
  const inputId = `policy-${cfg.key}`;

  return (
    <div style={{ marginBottom: 'var(--rs-space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--rs-space-1)', alignItems: 'center', gap: 'var(--rs-space-2)', flexWrap: 'wrap' }}>
        <label htmlFor={inputId} style={{ fontSize: 'var(--rs-text-sm)', color: 'var(--rs-text-on-dark)', fontWeight: 700 }}>{cfg.label}</label>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--rs-space-1)' }}>
          <span className="rs-pill rs-pill-real" title="Reality">
            <span className="rs-sr-only">Real: </span>{base.toFixed(digits)}
          </span>
          <span className="rs-pill rs-pill-fork" title="Your fork">
            <span className="rs-sr-only">Your fork: </span>{value.toFixed(digits)}
          </span>
          <span style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-2xs)' }}>{cfg.unit}</span>
          {deltaStr && (
            <span style={{ color: deltaColor, fontSize: 'var(--rs-text-2xs)', fontWeight: 800, fontFamily: 'var(--rs-font-mono)' }}>
              {deltaStr}
            </span>
          )}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', minHeight: 44, accentColor: 'var(--rs-fork)', cursor: 'pointer' }}
      />
    </div>
  );
}

export default function PolicyEditor({ baseIndicators, basePolicies }: Props) {
  const { policyDraft, setPolicyDraft } = useGameStore();

  const val = (key: string, fallback: number) =>
    policyDraft[key] !== undefined ? policyDraft[key] : fallback;

  const basePolicy = (key: string): number => {
    const v = (basePolicies as Record<string, unknown>)[key];
    return typeof v === 'number' ? v : 5;
  };

  return (
    <div>
      <h2 className="game-eyebrow" style={{ margin: '0 0 var(--rs-space-1)' }}>Budget</h2>
      <p style={{ margin: '0 0 var(--rs-space-3)', fontSize: 'var(--rs-text-xs)', color: 'var(--rs-muted-on-dark)' }}>
        Teal is what really happened. Coral is what you’re about to do.
      </p>

      {INDICATOR_SLIDERS.map(cfg => (
        <Slider
          key={cfg.key}
          cfg={cfg}
          base={baseIndicators[cfg.key] ?? (cfg.min + cfg.max) / 2}
          value={val(cfg.key, baseIndicators[cfg.key] ?? (cfg.min + cfg.max) / 2)}
          onChange={v => setPolicyDraft({ [cfg.key]: v })}
        />
      ))}

      <h2 className="game-eyebrow" style={{ margin: 'var(--rs-space-4) 0 var(--rs-space-3)' }}>State policies</h2>

      {POLICY_SLIDERS.map(cfg => (
        <Slider
          key={cfg.key}
          cfg={cfg}
          base={basePolicy(cfg.key)}
          value={val(cfg.key, basePolicy(cfg.key))}
          onChange={v => setPolicyDraft({ [cfg.key]: v })}
        />
      ))}
    </div>
  );
}
