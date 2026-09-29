import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Fork } from '../store/gameStore';

/**
 * Opt-in control to publish a fork to the public Hall of Worlds. Nothing is
 * shared until the player explicitly publishes; unpublishing takes it straight
 * back to private.
 */
export default function PublishToHall({ fork }: { fork: Fork }) {
  const publishFork = useGameStore(s => s.publishFork);
  const isPublic = !!fork.isPublic;
  const [title, setTitle] = useState(fork.title ?? '');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}wall/${fork.worldId}`;

  async function toggle(next: boolean) {
    setBusy(true);
    await publishFork(fork.worldId, next, next ? title : undefined);
    setBusy(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — the link is still visible for manual copy.
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '2px dashed rgba(255,255,255,0.1)' }}>
      <div className="game-badge game-badge-yellow" style={{ marginBottom: 8, display: 'inline-flex' }}>
        {isPublic ? '🏛️ PUBLISHED TO HALL' : '🔒 PRIVATE WORLD'}
      </div>

      {!isPublic ? (
        <>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Name your world (optional)"
            maxLength={80}
            style={{
              width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: '9px 11px',
              background: 'rgba(0,0,0,0.3)', color: '#fff', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)', fontSize: 13,
            }}
          />
          <button
            onClick={() => toggle(true)}
            disabled={busy}
            className="game-button game-button-dark"
            style={{ width: '100%', padding: '11px 0', fontSize: 13 }}
          >
            {busy ? '⏳ PUBLISHING…' : '🏛️ PUBLISH TO HALL OF WORLDS'}
          </button>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>
            Lists this fork publicly and makes its front pages shareable. You can unpublish anytime.
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              readOnly
              value={shareUrl}
              onFocus={e => e.currentTarget.select()}
              style={{
                flex: 1, minWidth: 0, padding: '9px 11px', background: 'rgba(0,0,0,0.3)', color: '#fff',
                borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', fontSize: 12,
              }}
            />
            <button onClick={copyLink} className="game-button game-button-cyan" style={{ padding: '9px 14px', fontSize: 12, flexShrink: 0 }}>
              {copied ? '✓ COPIED' : 'COPY'}
            </button>
          </div>
          <button
            onClick={() => toggle(false)}
            disabled={busy}
            className="game-button game-button-dark"
            style={{ width: '100%', padding: '9px 0', fontSize: 12, marginTop: 8, opacity: 0.85 }}
          >
            {busy ? '⏳…' : 'UNPUBLISH (make private)'}
          </button>
        </>
      )}
    </div>
  );
}
