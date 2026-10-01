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

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const, minHeight: 44, padding: '0 var(--rs-space-3)',
    background: 'var(--rs-paper)', color: 'var(--rs-ink)', borderRadius: 'var(--rs-radius-md)',
    border: 'var(--rs-border-thin)', font: '500 var(--rs-text-sm) var(--rs-font-body)',
  };

  return (
    <section style={{ marginTop: 'var(--rs-space-4)', paddingTop: 'var(--rs-space-4)', borderTop: '1px solid var(--rs-hud-line)' }}>
      <h2 className="game-eyebrow" style={{ margin: '0 0 var(--rs-space-2)' }}>
        {isPublic ? 'Live in the Hall of Worlds' : 'Private world'}
      </h2>

      {!isPublic ? (
        <>
          <label htmlFor={`world-title-${fork.worldId}`} className="rs-sr-only">World name</label>
          <input
            id={`world-title-${fork.worldId}`}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Name your world (optional)"
            maxLength={80}
            style={{ ...inputStyle, marginBottom: 'var(--rs-space-2)' }}
          />
          <button
            onClick={() => toggle(true)}
            disabled={busy}
            className="game-button game-button-dark"
            style={{ width: '100%' }}
          >
            {busy ? 'Publishing…' : 'Publish to the Hall of Worlds'}
          </button>
          <p style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-2xs)', margin: 'var(--rs-space-2) 0 0', lineHeight: 1.5 }}>
            Puts this fork on public display and makes its front pages shareable. Change your mind? Unpublish anytime.
          </p>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--rs-space-2)' }}>
            <label htmlFor={`share-url-${fork.worldId}`} className="rs-sr-only">Share link</label>
            <input
              id={`share-url-${fork.worldId}`}
              readOnly
              value={shareUrl}
              onFocus={e => e.currentTarget.select()}
              style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: 'var(--rs-font-mono)', fontSize: 'var(--rs-text-xs)' }}
            />
            <button onClick={copyLink} className="game-button game-button-dark" style={{ flexShrink: 0 }} aria-live="polite">
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <button
            onClick={() => toggle(false)}
            disabled={busy}
            className="game-button game-button-dark"
            style={{ width: '100%', marginTop: 'var(--rs-space-2)' }}
          >
            {busy ? 'Making it private…' : 'Unpublish and make private'}
          </button>
        </>
      )}
    </section>
  );
}
