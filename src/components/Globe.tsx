import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Viewer,
  Ion,
  GeoJsonDataSource,
  Color,
  Cartesian3,
  PolylineGlowMaterialProperty,
  ColorMaterialProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Entity,
  ConstantProperty,
  ArcType,
  EllipsoidTerrainProvider,
  ImageryLayer,
  SingleTileImageryProvider,
  Math as CesiumMath,
  CustomDataSource,
  VerticalOrigin,
  NearFarScalar,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useWorldStore } from '../store/worldStore';
import type { WorldEvent } from '../store/worldStore';
import { useRegionStore, SUPPORTED_DRILL_COUNTRIES } from '../store/regionStore';
import { NUMERIC_TO_ISO3, countryName, COUNTRY_CENTROIDS as CENTROIDS } from '../data/countries';
import type { FeatureCollection, Feature } from 'geojson';
import { eventPinDataUrl } from '../lib/gameArt';

const cesiumToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
if (cesiumToken) Ion.defaultAccessToken = cesiumToken;



const MAX_EVENT_PINS = 10;

// Event arc colors by type
const ARC_COLORS: Record<string, Color> = {
  sanction:           Color.fromCssColorString('#FF2E93').withAlpha(0.9), // Laser Magenta
  trade_deal:         Color.fromCssColorString('#00F0FF').withAlpha(0.9), // Cyber Cyan
  military_posture:   Color.fromCssColorString('#9D00FF').withAlpha(0.9), // Electric Violet
  diplomatic_protest: Color.fromCssColorString('#FFB800').withAlpha(0.85),
  alliance_formed:    Color.fromCssColorString('#00F0FF').withAlpha(0.9), // Cyber Cyan
  alliance_broken:    Color.fromCssColorString('#FF2E93').withAlpha(0.9), // Laser Magenta
  conflict_risk:      Color.fromCssColorString('#FF0055').withAlpha(0.95),
};

// ─── ISO 3166-1 numeric → alpha-3 lookup ─────────────────────────────────────
// Needed because world-atlas TopoJSON entities use numeric IDs (no ISO_A3).
// We enrich each entity after load so the rest of the code stays unchanged.

// entity.id (numeric string) → ISO3 — populated after GeoJSON load
const entityIso3Map = new Map<string, string>();

// ─── Admin-1 GeoJSON (cached at module level) ────────────────────────────────
// Natural Earth 50m admin-1 state/province boundaries via jsDelivr CDN
const ADMIN1_URL =
  'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_1_states_provinces.geojson';

// Module-level cache: null = not started, 'loading' = in flight, FeatureCollection = loaded
let admin1Cache: null | 'loading' | FeatureCollection = null;
const admin1Waiters: Array<(fc: FeatureCollection) => void> = [];

function loadAdmin1(): Promise<FeatureCollection> {
  if (admin1Cache && admin1Cache !== 'loading') {
    return Promise.resolve(admin1Cache);
  }
  if (admin1Cache === 'loading') {
    return new Promise(resolve => admin1Waiters.push(resolve));
  }
  admin1Cache = 'loading';
  return fetch(ADMIN1_URL)
    .then(r => r.json())
    .then((fc: FeatureCollection) => {
      admin1Cache = fc;
      admin1Waiters.forEach(fn => fn(fc));
      admin1Waiters.length = 0;
      return fc;
    });
}

/** Filter admin-1 FeatureCollection to a single country by ISO3 code */
function filterAdmin1(fc: FeatureCollection, iso3: string): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.filter((f: Feature) => {
      const p = f.properties ?? {};
      return p['adm0_a3'] === iso3 || p['adm0_iso'] === iso3;
    }),
  };
}

// Altitude threshold (metres) below which we switch to admin-1 view
const DRILL_ALTITUDE = 2_000_000;

// ─── Arc helpers ─────────────────────────────────────────────────────────────
function arcPositions(
  from: [number, number],
  to: [number, number],
  steps = 32,
  apexAlt = 600_000
): Cartesian3[] {
  const pts: Cartesian3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lon = from[0] + (to[0] - from[0]) * t;
    const lat = from[1] + (to[1] - from[1]) * t;
    const alt = Math.sin(Math.PI * t) * apexAlt;
    pts.push(Cartesian3.fromDegrees(lon, lat, alt));
  }
  return pts;
}

function drawArc(viewer: Viewer, event: WorldEvent, durationMs = 4000): void {
  if (!event.to_country) return;
  const from = CENTROIDS[event.from_country];
  const to   = CENTROIDS[event.to_country];
  if (!from || !to) return;

  const color = ARC_COLORS[event.event_type] ?? Color.WHITE.withAlpha(0.7);
  const width = event.event_type === 'conflict_risk' ? 3 : 2;

  const entity = viewer.entities.add({
    polyline: {
      positions: arcPositions(from, to),
      width,
      material: new PolylineGlowMaterialProperty({ glowPower: 0.25, color }),
      clampToGround: false,
    },
  });

  setTimeout(() => {
    try { viewer.entities.remove(entity); } catch { /* viewer may be destroyed */ }
  }, durationMs);
}

function choroplethColor(): Color {
  // Always transparent so the rich 3D cartoon globe imagery is 100% clean, crisp, and unobstructed
  return Color.TRANSPARENT;
}

// ─── Tooltip overlay ─────────────────────────────────────────────────────────
interface TooltipState { iso3: string; x: number; y: number }

function Tooltip({ tip }: { tip: TooltipState }) {
  const name = countryName(tip.iso3);

  return (
    <div style={{
      position:     'absolute',
      left:         tip.x + 16,
      top:          tip.y - 12,
      pointerEvents:'none',
      background:   'var(--bg-hud-panel)',
      backdropFilter: 'blur(12px)',
      border:       '3px solid var(--game-border-ink)',
      outline:      '1px solid var(--accent-cyan)',
      borderRadius: 'var(--radius-game-md)',
      padding:      '10px 14px',
      color:        '#fff',
      fontSize:     12,
      zIndex:       40,
      minWidth:     160,
      boxShadow:    'var(--hud-shadow-lg), var(--hud-shadow-glow-cyan)',
    }}>
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontWeight: 800,
        fontSize: 15,
        color: 'var(--accent-yellow)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span>{name}</span>
        <span style={{
          fontSize: 10,
          background: '#1a233b',
          border: '1.5px solid var(--accent-cyan)',
          color: 'var(--accent-cyan)',
          padding: '1px 5px',
          borderRadius: 4,
        }}>
          {tip.iso3}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-heading)',
        color: 'var(--accent-cyan)',
        fontSize: 10,
        marginTop: 6,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        ⚡ Click to inspect →
      </div>
    </div>
  );
}

// ─── Drill-down indicator ─────────────────────────────────────────────────────
function DrillBadge({ country }: { country: string }) {
  return (
    <div style={{
      position:      'absolute',
      bottom:        32,
      left:          '50%',
      transform:     'translateX(-50%)',
      background:    'linear-gradient(90deg, #15092b, #09122b)',
      border:        '3px solid var(--game-border-ink)',
      outline:       '1px solid var(--accent-yellow)',
      borderRadius:  'var(--radius-game-pill)',
      padding:       '6px 18px',
      fontSize:      12,
      fontFamily:    'var(--font-heading)',
      fontWeight:    800,
      color:         'var(--accent-yellow)',
      pointerEvents: 'none',
      boxShadow:     'var(--hud-shadow), var(--hud-shadow-glow-yellow)',
      zIndex:        30,
    }}>
      🔍 REGION VIEW — {countryName(country).toUpperCase()} · CLICK A REGION TO COMMAND
    </div>
  );
}

// ─── Main Globe component ─────────────────────────────────────────────────────
export default function Globe() {
  const containerRef   = useRef<HTMLDivElement>(null);
  const viewerRef      = useRef<Viewer | null>(null);
  const sourceRef      = useRef<GeoJsonDataSource | null>(null);
  const regionSrcRef   = useRef<GeoJsonDataSource | null>(null);
  const handlerRef     = useRef<ScreenSpaceEventHandler | null>(null);
  const lastEventIdRef = useRef<number>(-1);
  const pinSrcRef      = useRef<CustomDataSource | null>(null);
  const hoverTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drillCountryRef = useRef<string | null>(null);

  const {
    choroplethValues, loadChoropleth,
    selectedCountry, worldEvents, pulseCountry, setPulseCountry, setGlobeReady,
  } = useWorldStore();

  useRegionStore(); // subscribe so RegionPanel re-renders when selection changes
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [drillCountry, setDrillCountry] = useState<string | null>(null);
  // Cesium boots and then pulls ~110m country geometry from a CDN, which takes
  // 15-25s cold. Without this the app is an unexplained black screen for that
  // whole window and reads as broken.
  const [globeStatus, setGlobeStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Mirror readiness into the store, and reset on unmount so a remount (e.g.
  // navigating between the globe and the dashboard) starts from 'loading' again.
  useEffect(() => {
    setGlobeReady(globeStatus === 'ready');
  }, [globeStatus, setGlobeReady]);
  useEffect(() => () => setGlobeReady(false), [setGlobeReady]);

  // ── Apply choropleth colors ──────────────────────────────────────────────
  const applyColors = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    for (const entity of source.entities.values) {
      if (entity.polygon) {
        entity.polygon.material = new ColorMaterialProperty(choroplethColor());
      }
    }
  }, []);

  useEffect(() => { loadChoropleth(); }, [loadChoropleth]);
  useEffect(() => { applyColors(); }, [choroplethValues, applyColors]);

  // ── Camera fly-to when a country is selected ─────────────────────────────
  // Fixed altitude, deliberately: viewer.flyTo(entity) frames the polygon tightly
  // and for most countries ends up below DRILL_ALTITUDE, which silently trips the
  // admin-1 region view and leaves the user staring at a blank globe while 2MB of
  // province geometry downloads. COUNTRY_CENTROIDS now covers every mapped
  // country, so a plain centroid flight works for all of them.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!selectedCountry || !viewer) return;
    const centroid = CENTROIDS[selectedCountry];
    if (!centroid) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(centroid[0], centroid[1], 3_200_000),
      // Look straight down. Without an explicit orientation the camera keeps
      // whatever heading/pitch it had, which after a long flight can leave it
      // pointing away from the globe — the user lands on empty starfield.
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 1.5,
    });
  }, [selectedCountry]);

  // ── Country pulse on player policy save ──────────────────────────────────
  useEffect(() => {
    if (!pulseCountry || !sourceRef.current) return;
    const source = sourceRef.current;

    for (const entity of source.entities.values) {
      const iso3 = entityIso3Map.get(entity.id);
      if (iso3 !== pulseCountry || !entity.polygon) continue;
      // Imperative Cesium scene write: flash the polygon white, then restore its
      // transparent color after 550ms.
      // eslint-disable-next-line react-hooks/immutability
      entity.polygon.material = new ColorMaterialProperty(Color.WHITE.withAlpha(0.95));
      const restoreColor = choroplethColor();
      setTimeout(() => {
        if (entity.polygon) {
          entity.polygon.material = new ColorMaterialProperty(restoreColor);
        }
        setPulseCountry(null);
      }, 550);
      break;
    }
  }, [pulseCountry, setPulseCountry]);

  // ── Draw event arcs for newly-arrived world events ────────────────────────
  useEffect(() => {
    if (!viewerRef.current || !worldEvents.length) return;
    if (lastEventIdRef.current === -1) {
      lastEventIdRef.current = Math.max(...worldEvents.map(e => e.id));
      return;
    }
    const newEvents = worldEvents.filter(e => e.id > lastEventIdRef.current && e.to_country);
    for (const ev of newEvents.slice(0, 12)) drawArc(viewerRef.current, ev);
    if (newEvents.length) lastEventIdRef.current = Math.max(...newEvents.map(e => e.id));
  }, [worldEvents]);

  // ── Event pins: one per country, for its most recent event ────────────────
  // Pins carry ISO_A3 like the country polygons do, so the existing click and
  // hover handlers treat a pin as "that country" with no extra wiring.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || globeStatus !== 'ready') return;
    if (!pinSrcRef.current) {
      pinSrcRef.current = new CustomDataSource('event-pins');
      viewer.dataSources.add(pinSrcRef.current);
    }
    const pins = pinSrcRef.current.entities;
    pins.removeAll();

    const seen = new Set<string>();
    for (const ev of worldEvents) {  // store keeps these newest-first
      if (seen.has(ev.from_country) || seen.size >= MAX_EVENT_PINS) continue;
      const at = CENTROIDS[ev.from_country];
      if (!at) continue;
      const isNewest = seen.size === 0;
      seen.add(ev.from_country);
      pins.add({
        position: Cartesian3.fromDegrees(at[0], at[1], 0),
        properties: { ISO_A3: ev.from_country },
        billboard: {
          image: eventPinDataUrl(ev.event_type, isNewest),
          width: 40,
          height: 52,
          verticalOrigin: VerticalOrigin.BOTTOM,
          // Full size up close, shrink as the camera pulls back to orbit.
          scaleByDistance: new NearFarScalar(2_000_000, 1.0, 20_000_000, 0.55),
          // Fade out from deep space, where the globe is too small to pin on.
          translucencyByDistance: new NearFarScalar(50_000_000, 1.0, 90_000_000, 0.0),
        },
      });
    }
  }, [worldEvents, globeStatus]);

  // ── Load / unload admin-1 regions based on altitude + selected country ────
  const loadRegions = useCallback(async (viewer: Viewer, iso3: string) => {
    // Remove previous region source
    if (regionSrcRef.current) {
      viewer.dataSources.remove(regionSrcRef.current, true);
      regionSrcRef.current = null;
    }
    drillCountryRef.current = iso3;
    setDrillCountry(iso3);

    try {
      const fc      = await loadAdmin1();
      const filtered = filterAdmin1(fc, iso3);
      if (filtered.features.length === 0) return;

      // Check we're still zoomed in (user may have zoomed out while loading)
      if (drillCountryRef.current !== iso3) return;

      const src = await GeoJsonDataSource.load(filtered, {
        stroke:      Color.WHITE.withAlpha(0.6),
        fill:        Color.fromCssColorString('#6366f1').withAlpha(0.15),
        strokeWidth: 1.5,
      });
      viewer.dataSources.add(src);
      regionSrcRef.current = src;
    } catch {
      // Admin-1 fetch failed — silently degrade
    }
  }, []);

  const unloadRegions = useCallback((viewer: Viewer) => {
    if (regionSrcRef.current) {
      viewer.dataSources.remove(regionSrcRef.current, true);
      regionSrcRef.current = null;
    }
    drillCountryRef.current = null;
    setDrillCountry(null);
  }, []);

  // ── Cesium viewer initialisation ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Viewer(containerRef.current, {
      animation:             false,
      baseLayerPicker:       false,
      fullscreenButton:      false,
      geocoder:              false,
      homeButton:            false,
      infoBox:               false,
      navigationHelpButton:  false,
      sceneModePicker:       false,
      selectionIndicator:    false,
      timeline:              false,
      creditContainer:       document.createElement('div'),
      // Flat ellipsoid — prevents terrain tiles from depth-occluding polygon fills
      terrainProvider:       new EllipsoidTerrainProvider(),
      // Illustrated Earth as the base layer. A single equirectangular PNG needs
      // no tile server and no Cesium Ion token, and being opaque it also removes
      // the failed-Ion-imagery case that left the globe rendering as bare space.
      baseLayer: new ImageryLayer(
        new SingleTileImageryProvider({
          url: `${import.meta.env.BASE_URL}earth-cartoon.png`,
          tileWidth: 4096,
          tileHeight: 2048,
        }),
      ),
    });

    // Real sun position, so the visitor's own daylight is reflected on the globe
    // as a day/night terminator across the imagery.
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.baseColor = Color.fromCssColorString('#0b1b2b');

    // Disable atmosphere scattering. Cesium's computeAtmosphereScattering shader
    // fails to compile under ANGLE's Metal backend on Apple Silicon — ANGLE
    // emits invalid MSL (a __metal_generic reference that will not bind), the
    // vertex program fails to link, and the globe surface never draws (a black
    // sphere). enableLighting selects the dynamic-atmosphere-lighting shader
    // permutation, so leaving these on is what triggered it. The day/night
    // terminator above does not depend on the atmosphere, so turning it off
    // costs only the blue limb haze.
    viewer.scene.globe.showGroundAtmosphere = false;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
    viewerRef.current = viewer;

    // Dev-only handle. The globe's render state is otherwise unreachable from
    // outside React, which makes camera and imagery problems hard to diagnose.
    if (import.meta.env.DEV) {
      (window as unknown as { __viewer?: Viewer }).__viewer = viewer;
    }


    // world-atlas TopoJSON: simplified geometry + numeric ISO IDs.
    // GeoJsonDataSource hardcodes arcType=RHUMB which overflows on large polygons (CesiumJS 1.141).
    // Fix: switch fill to GEODESIC + disable outline entirely before adding to the scene.
    // ISO_A3 is added via numeric lookup so choropleth/click code stays unchanged.
    GeoJsonDataSource.load(
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      { stroke: Color.WHITE.withAlpha(0.25), fill: Color.TRANSPARENT, strokeWidth: 0.5 }
    ).then(source => {
      if (viewerRef.current?.isDestroyed()) return;
      entityIso3Map.clear();
      for (const entity of source.entities.values) {
        const iso3 = NUMERIC_TO_ISO3[entity.id];
        if (iso3) entityIso3Map.set(entity.id, iso3);
        if (entity.polygon) {
          entity.polygon.arcType = new ConstantProperty(ArcType.GEODESIC);
          entity.polygon.outline = new ConstantProperty(false);
        }
      }
      viewerRef.current!.dataSources.add(source);
      sourceRef.current = source;
      applyColors();

      // The fetch resolving is not the same as the globe being painted, so wait
      // for a couple of rendered frames before clearing the loading state.
      //
      // Deliberately NOT gated on viewer.dataSourceDisplay.ready: that property
      // is updated during rendering, so in any environment where frames are not
      // ticking (a hidden tab, a throttled automation pane) it stays false
      // forever and the spinner never clears. The short timeout is the backstop.
      const viewer = viewerRef.current!;
      let frames = 0;
      const onFrame = () => {
        if (viewer.isDestroyed()) return;
        if (++frames >= 2) {
          viewer.scene.postRender.removeEventListener(onFrame);
          setGlobeStatus('ready');
        }
      };
      viewer.scene.postRender.addEventListener(onFrame);
      window.setTimeout(() => {
        if (!viewer.isDestroyed()) {
          viewer.scene.postRender.removeEventListener(onFrame);
          setGlobeStatus('ready');
        }
      }, 5000);
    }).catch(err => {
      console.error('[Globe] GeoJSON load failed:', err);
      setGlobeStatus('error');
    });

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    // Click handler — country OR region
    handler.setInputAction((evt: { position: import('cesium').Cartesian2 }) => {
      const picked = viewer.scene.pick(evt.position);
      if (!defined(picked) || !(picked.id instanceof Entity)) {
        useWorldStore.getState().selectCountry(null);
        useRegionStore.getState().selectRegion(null);
        return;
      }
      const entity = picked.id as Entity;
      const props  = entity.properties as Record<string, { getValue: () => string }> | undefined;

      // Check if this is a region entity (admin-1 has 'name' + 'adm0_a3')
      const regionName    = props?.['name']?.getValue();
      const regionIso32   = props?.['adm0_a3']?.getValue() ?? props?.['adm0_iso']?.getValue();
      const regionCode    = props?.['iso_3166_2']?.getValue()
                         ?? props?.['postal']?.getValue()
                         ?? props?.['name']?.getValue();

      if (regionSrcRef.current && regionName && regionIso32) {
        // This is an admin-1 region click
        useRegionStore.getState().selectRegion({
          code:        regionCode ?? regionName,
          name:        regionName,
          countryCode: regionIso32,
        });
        setTooltip(null);
        return;
      }

      // Otherwise treat as country click
      const iso3 = entityIso3Map.get(entity.id) ?? props?.['ISO_A3']?.getValue() ?? props?.['iso_a3']?.getValue();
      if (iso3) {
        useWorldStore.getState().selectCountry(iso3);
        useRegionStore.getState().selectRegion(null);
      }
      setTooltip(null);
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Mouse move → hover tooltip
    handler.setInputAction((evt: { endPosition: import('cesium').Cartesian2 }) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      const picked = viewer.scene.pick(evt.endPosition);
      if (!defined(picked) || !(picked.id instanceof Entity)) { setTooltip(null); return; }
      const entity = picked.id as Entity;
      const props  = entity.properties as Record<string, { getValue: () => string }> | undefined;
      const iso3   = entityIso3Map.get(entity.id) ?? props?.['ISO_A3']?.getValue() ?? props?.['iso_a3']?.getValue();
      if (!iso3) { setTooltip(null); return; }
      const x = evt.endPosition.x;
      const y = evt.endPosition.y;
      hoverTimerRef.current = setTimeout(() => setTooltip({ iso3, x, y }), 300);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // Camera move → detect altitude + selected country for drill-down
    viewer.camera.changed.addEventListener(() => {
      if (!viewerRef.current) return;
      const altitude  = viewerRef.current.camera.positionCartographic.height;
      const selected  = useWorldStore.getState().selectedCountry;
      const isDrillable = selected && SUPPORTED_DRILL_COUNTRIES.has(selected);
      const currentDrill = drillCountryRef.current;

      if (altitude < DRILL_ALTITUDE && isDrillable) {
        if (currentDrill !== selected) {
          loadRegions(viewerRef.current, selected!);
        }
      } else if (altitude >= DRILL_ALTITUDE && currentDrill) {
        unloadRegions(viewerRef.current);
      }
    });

    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      handlerRef.current?.destroy();
      viewerRef.current?.destroy();
      viewerRef.current = null;
      sourceRef.current = null;
      regionSrcRef.current = null;
      pinSrcRef.current = null;
    };
    // applyColors/loadRegions/unloadRegions are stable useCallback([]) refs, so
    // listing them keeps this viewer-init effect running exactly once on mount.
  }, [applyColors, loadRegions, unloadRegions]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#000' }} />
      {globeStatus !== 'ready' && <GlobeStatus status={globeStatus} />}
      {tooltip && <Tooltip tip={tooltip} />}
      {drillCountry && <DrillBadge country={drillCountry} />}
    </div>
  );
}

// ─── Globe loading / error state ──────────────────────────────────────────────
function GlobeStatus({ status }: { status: 'loading' | 'error' }) {
  const failed = status === 'error';
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14,
        pointerEvents: 'none', textAlign: 'center', padding: 24,
      }}
    >
      {!failed && (
        <div
          style={{
            width: 46, height: 46, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.12)',
            borderTopColor: '#818cf8',
            animation: 'rs-spin 900ms linear infinite',
          }}
        />
      )}
      <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
        {failed ? 'Could not load country boundaries' : 'Building the world…'}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 300, lineHeight: 1.5 }}>
        {failed
          ? 'The country geometry CDN did not respond. Check your connection and reload.'
          : 'Loading boundaries for 210 countries. First load takes a few seconds.'}
      </div>
      <style>{'@keyframes rs-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}


