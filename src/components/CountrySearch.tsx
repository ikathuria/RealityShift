import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorldStore } from '../store/worldStore';
import { GLOBE_COUNTRIES } from '../data/countries';

/**
 * Keyboard-accessible country picker.
 *
 * Selecting a country on the globe was previously canvas-picking only: there was
 * no keyboard path to any country at all, and finding a small one by eye on a
 * rotating sphere is slow even with a mouse. This is the accessible equivalent
 * and doubles as the discoverable entry point to the country panel, which is
 * where "Take Over" lives.
 */
export default function CountrySearch({ fullWidth = false }: { fullWidth?: boolean } = {}) {
  const { selectCountry, selectedCountry } = useWorldStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOBE_COUNTRIES.slice(0, 8);
    return GLOBE_COUNTRIES
      .filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().startsWith(q))
      // Prefix matches first — typing "ind" should surface India above Indonesia.
      .sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return ap - bp || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [query]);

  // Reset the highlighted option whenever the query changes. Done during render
  // (the previous-value pattern) rather than in an effect, which avoids an extra
  // commit and the set-state-in-effect lint.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted option in view when navigating by keyboard.
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const commit = (code: string) => {
    selectCountry(code);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(i => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && matches[activeIndex]) {
        e.preventDefault();
        commit(matches[activeIndex].code);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const listboxId = 'country-search-listbox';

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: fullWidth ? '100%' : 232 }}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label="Search countries"
        placeholder="Search countries…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', height: 32, boxSizing: 'border-box',
          padding: '0 10px',
          background: 'rgba(255,255,255,0.06)',
          border: 'var(--border-subtle)',
          borderRadius: 8,
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          fontSize: 'var(--font-size-sm)',
          outline: 'none',
        }}
      />

      {open && matches.length > 0 && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute', top: 38, left: 0, right: 0, zIndex: 40,
            margin: 0, padding: 4, listStyle: 'none',
            maxHeight: 264, overflowY: 'auto',
            background: 'var(--surface-floating)',
            backdropFilter: 'var(--surface-floating-blur)',
            border: 'var(--border-strong)',
            borderRadius: 'var(--radius-panel)',
            boxShadow: 'var(--shadow-floating)',
          }}
        >
          {matches.map((c, i) => (
            <li
              key={c.code}
              role="option"
              aria-selected={c.code === selectedCountry}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={e => { e.preventDefault(); commit(c.code); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, minHeight: 30, padding: '0 8px', borderRadius: 6,
                cursor: 'pointer',
                background: i === activeIndex ? 'rgba(99,102,241,0.22)' : 'transparent',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <span>{c.name}</span>
              <span style={{ color: 'var(--text-faint)', fontSize: 'var(--font-size-xs)' }}>
                {c.code}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
