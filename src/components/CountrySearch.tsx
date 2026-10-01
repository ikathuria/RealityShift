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
          width: '100%', height: 44, boxSizing: 'border-box',
          padding: '0 var(--rs-space-3)',
          background: 'var(--rs-paper)',
          border: 'var(--rs-border)',
          borderRadius: 'var(--rs-radius-md)',
          boxShadow: 'var(--rs-shadow-sm)',
          color: 'var(--rs-ink)',
          fontFamily: 'var(--rs-font-body)',
          fontWeight: 700,
          fontSize: 'var(--rs-text-sm)',
        }}
      />

      {open && matches.length > 0 && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute', top: 52, left: 0, right: 0, zIndex: 40,
            margin: 0, padding: 'var(--rs-space-1)', listStyle: 'none',
            maxHeight: 264, overflowY: 'auto',
            background: 'var(--rs-paper)',
            color: 'var(--rs-ink)',
            border: 'var(--rs-border)',
            borderRadius: 'var(--rs-radius-md)',
            boxShadow: 'var(--rs-shadow-md)',
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
                gap: 8, minHeight: 36, padding: '0 var(--rs-space-2)', borderRadius: 'var(--rs-radius-sm)',
                cursor: 'pointer',
                background: i === activeIndex ? 'var(--rs-sun)' : 'transparent',
                fontSize: 'var(--rs-text-sm)', fontWeight: 700,
              }}
            >
              <span>{c.name}</span>
              <span style={{ color: 'var(--rs-muted-on-paper)', font: '700 var(--rs-text-2xs) var(--rs-font-mono)' }}>
                {c.code}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
