import { useEffect, useRef, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
} from 'd3-force';
import type { Government, GovNode, GovRelation } from '../data/government';
import { BRANCH_META, RELATION_LABELS } from '../data/government';

// Simulation node — d3-force mutates x/y/vx/vy in place, and fx/fy pin a node.
interface SimNode extends GovNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink {
  // d3's forceLink replaces the string ids with node object references in place.
  source: string | SimNode;
  target: string | SimNode;
  relation: GovRelation;
}

// Apex offices (rank 0) render largest; power fades with rank.
function nodeRadius(n: GovNode): number {
  return 26 - Math.min(n.rank, 4) * 3.2;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default function GovernmentGraph({ government }: { government: Government }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [size, setSize] = useState({ w: 900, h: 600 });
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  // Bumped on every simulation tick to re-render node/edge positions.
  const [, setTick] = useState(0);

  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);

  // Latest values for the window-level pointer handlers (avoids stale closures).
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const dragRef = useRef<{ node: SimNode } | null>(null);
  const panRef = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);

  // Fit all nodes into the viewport with a little padding.
  const fitView = () => {
    const nodes = nodesRef.current;
    const { w, h } = sizeRef.current;
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const r = nodeRadius(n) + 30;
      minX = Math.min(minX, n.x - r);
      minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r);
      maxY = Math.max(maxY, n.y + r);
    }
    const bw = maxX - minX, bh = maxY - minY;
    const k = clamp(Math.min(w / bw, h / bh), 0.35, 1.6);
    setView({
      k,
      x: (w - k * (minX + maxX)) / 2,
      y: (h - k * (minY + maxY)) / 2,
    });
  };

  // Measure the container.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setSize({ w: Math.max(320, r.width), h: Math.max(360, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build the simulation whenever the country changes.
  useEffect(() => {
    const { w, h } = sizeRef.current;
    const nodes: SimNode[] = government.nodes.map(n => ({
      ...n,
      // Seed apex offices at the centre and others on a ring for a stable layout.
      x: w / 2 + Math.cos(n.rank) * (30 + n.rank * 20) + (Math.random() - 0.5) * 30,
      y: h / 2 + Math.sin(n.rank * 1.7) * (30 + n.rank * 20) + (Math.random() - 0.5) * 30,
    }));
    const links: SimLink[] = government.edges.map(e => ({ ...e }));

    const sim = forceSimulation<SimNode>(nodes)
      .force('link', forceLink<SimNode, SimLink>(links).id(d => d.id).distance(135).strength(0.4))
      .force('charge', forceManyBody<SimNode>().strength(-720))
      .force('collide', forceCollide<SimNode>().radius(d => nodeRadius(d) + 30))
      .force('x', forceX<SimNode>(w / 2).strength(0.05))
      .force('y', forceY<SimNode>(h / 2).strength(0.07))
      .alpha(1)
      .alphaDecay(0.03);

    sim.on('tick', () => setTick(t => t + 1));
    sim.on('end', () => fitView());

    simRef.current = sim;
    nodesRef.current = nodes;
    linksRef.current = links;
    setSelected(null);
    // Fit once the layout has had a moment to spread out, even before it settles.
    const t = setTimeout(fitView, 600);
    return () => {
      clearTimeout(t);
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [government.countryCode]);

  // Keep the centring forces aligned with the viewport size, gently reheating.
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    (sim.force('x') as ReturnType<typeof forceX<SimNode>> | undefined)?.x(size.w / 2);
    (sim.force('y') as ReturnType<typeof forceY<SimNode>> | undefined)?.y(size.h / 2);
    sim.alpha(0.3).restart();
  }, [size.w, size.h]);

  // Window-level drag/pan handlers, registered once.
  useEffect(() => {
    const screenToGraph = (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      const v = viewRef.current;
      const sx = clientX - (rect?.left ?? 0);
      const sy = clientY - (rect?.top ?? 0);
      return { x: (sx - v.x) / v.k, y: (sy - v.y) / v.k };
    };

    const onMove = (e: PointerEvent) => {
      if (dragRef.current) {
        const g = screenToGraph(e.clientX, e.clientY);
        dragRef.current.node.fx = g.x;
        dragRef.current.node.fy = g.y;
        setTick(t => t + 1);
      } else if (panRef.current) {
        const p = panRef.current;
        setView(v => ({ ...v, x: p.vx + (e.clientX - p.px), y: p.vy + (e.clientY - p.py) }));
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        // Release the node back to the physics sim.
        dragRef.current.node.fx = null;
        dragRef.current.node.fy = null;
        simRef.current?.alphaTarget(0);
        dragRef.current = null;
      }
      panRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  // Non-passive wheel zoom, anchored at the cursor.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const rect = svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const k = clamp(v.k * factor, 0.35, 3);
      setView({
        k,
        x: sx - (sx - v.x) * (k / v.k),
        y: sy - (sy - v.y) * (k / v.k),
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onNodePointerDown = (e: React.PointerEvent, node: SimNode) => {
    e.stopPropagation();
    setSelected(node.id);
    simRef.current?.alphaTarget(0.3).restart();
    node.fx = node.x;
    node.fy = node.y;
    dragRef.current = { node };
  };

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    setSelected(null);
    const v = viewRef.current;
    panRef.current = { px: e.clientX, py: e.clientY, vx: v.x, vy: v.y };
  };

  const nodes = nodesRef.current;
  const links = linksRef.current;
  const selectedNode = nodes.find(n => n.id === selected) ?? null;

  // Ids of nodes adjacent to the selection, for highlighting.
  const neighbors = new Set<string>();
  if (selectedNode) {
    for (const l of links) {
      const s = (typeof l.source === 'object' ? l.source.id : l.source);
      const t = (typeof l.target === 'object' ? l.target.id : l.target);
      if (s === selectedNode.id) neighbors.add(t);
      if (t === selectedNode.id) neighbors.add(s);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        onPointerDown={onBackgroundPointerDown}
        style={{ display: 'block', cursor: panRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <defs>
          <marker id="gov-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.35)" />
          </marker>
        </defs>

        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {/* Edges */}
          {links.map((l, i) => {
            const s = l.source as SimNode;
            const t = l.target as SimNode;
            if (typeof s !== 'object' || typeof t !== 'object' || s.x == null || t.x == null) return null;
            const dx = t.x - s.x, dy = t.y - s.y;
            const dist = Math.hypot(dx, dy) || 1;
            const ux = dx / dist, uy = dy / dist;
            const x1 = s.x + ux * (nodeRadius(s) + 2);
            const y1 = s.y + uy * (nodeRadius(s) + 2);
            const x2 = t.x - ux * (nodeRadius(t) + 8);
            const y2 = t.y - uy * (nodeRadius(t) + 8);
            const active = !selectedNode
              || s.id === selectedNode.id || t.id === selectedNode.id;
            const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
            return (
              <g key={i} style={{ opacity: active ? 1 : 0.12, transition: 'opacity 0.15s' }}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={active && selectedNode ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.28)'}
                  strokeWidth={active && selectedNode ? 2 : 1.2}
                  markerEnd="url(#gov-arrow)"
                />
                {selectedNode && active && (
                  <text
                    x={midX} y={midY - 3}
                    textAnchor="middle"
                    style={{ fill: 'var(--accent-cyan)', fontSize: 9, fontFamily: 'var(--font-heading)', pointerEvents: 'none' }}
                  >
                    {RELATION_LABELS[l.relation]}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const r = nodeRadius(n);
            const color = BRANCH_META[n.branch].color;
            const isSel = selectedNode?.id === n.id;
            const dim = selectedNode && !isSel && !neighbors.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                onPointerDown={e => onNodePointerDown(e, n)}
                style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1, transition: 'opacity 0.15s' }}
              >
                <circle
                  r={r}
                  fill="var(--bg-hud-card)"
                  stroke={color}
                  strokeWidth={isSel ? 4 : 2.5}
                  style={{ filter: isSel ? `drop-shadow(0 0 10px ${color})` : `drop-shadow(0 0 4px ${color})` }}
                />
                {n.kind === 'person' && (
                  <circle r={4} cy={-r + 6} fill={color} stroke="var(--bg-hud-card)" strokeWidth={1.5} />
                )}
                <text
                  textAnchor="middle"
                  y={r + 14}
                  style={{ fill: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-heading)', pointerEvents: 'none' }}
                >
                  {truncate(n.label, 24)}
                </text>
                {n.holder && (
                  <text
                    textAnchor="middle"
                    y={r + 27}
                    style={{ fill: color, fontSize: 10, fontFamily: 'var(--font-heading)', pointerEvents: 'none' }}
                  >
                    {truncate(n.holder, 26)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Controls */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
        <button className="game-button game-button-dark" style={ctrlBtn} onClick={() => setView(v => ({ ...v, k: clamp(v.k * 1.2, 0.35, 3) }))} aria-label="Zoom in">+</button>
        <button className="game-button game-button-dark" style={ctrlBtn} onClick={() => setView(v => ({ ...v, k: clamp(v.k / 1.2, 0.35, 3) }))} aria-label="Zoom out">−</button>
        <button className="game-button game-button-dark" style={{ ...ctrlBtn, width: 'auto', padding: '0 10px', fontSize: 10 }} onClick={fitView}>⤢ FIT</button>
        <button className="game-button game-button-dark" style={{ ...ctrlBtn, width: 'auto', padding: '0 10px', fontSize: 10 }} onClick={() => simRef.current?.alpha(0.9).restart()}>↻ REPLAY</button>
      </div>

      {/* Branch legend */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', flexWrap: 'wrap', gap: '6px 12px', maxWidth: 'calc(100% - 24px)' }}>
        {Object.entries(BRANCH_META).map(([key, meta]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, boxShadow: `0 0 6px ${meta.color}`, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted, #8a93b2)', fontSize: 10, fontFamily: 'var(--font-heading)' }}>{meta.label}</span>
          </div>
        ))}
      </div>

      {/* Selected node detail card */}
      {selectedNode && (
        <div
          className="game-card"
          style={{ position: 'absolute', top: 12, left: 12, width: 250, padding: '14px 16px', maxWidth: 'calc(100% - 24px)' }}
        >
          <div className="game-badge" style={{ background: BRANCH_META[selectedNode.branch].color, color: '#000', marginBottom: 8 }}>
            {BRANCH_META[selectedNode.branch].label}
          </div>
          <div className="game-font-heading" style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {selectedNode.label}
          </div>
          {selectedNode.holder && (
            <div style={{ color: BRANCH_META[selectedNode.branch].color, fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              {selectedNode.holder}
            </div>
          )}
          {selectedNode.note && (
            <div style={{ color: 'var(--text-secondary, #b7c0dd)', fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
              {selectedNode.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  padding: 0,
  fontSize: 16,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
