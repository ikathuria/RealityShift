import { isDemoWorld } from './demo';

export interface WorldChip {
  label: string;
  className: string;
  /** Adjective for alt text: "a forked India", "the live world's India". */
  describe: (place: string) => string;
}

/**
 * How to badge a world's content: the live world (the AI sim tracking reality),
 * a player's fork, or bundled sample content. Only forks get the "Fork" chip.
 */
export function worldChip(worldId: string, sample = false): WorldChip {
  if (sample || isDemoWorld(worldId)) {
    return { label: 'Sample', className: 'game-badge', describe: p => `a sample ${p}` };
  }
  if (worldId === 'live') {
    return { label: 'Live world', className: 'game-badge rs-chip-real', describe: p => `the live world's ${p}` };
  }
  return { label: 'Fork', className: 'game-badge rs-chip-fork', describe: p => `a forked ${p}` };
}
