import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Viewer,
  Ion,
  GeoJsonDataSource,
  Color,
  Cartesian3,
  PolylineGlowMaterialProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Entity,
  createWorldTerrainAsync,
  CesiumTerrainProvider,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useWorldStore } from '../store/worldStore';
import type { ChoroplethMode, WorldEvent } from '../store/worldStore';
import { useRegionStore, SUPPORTED_DRILL_COUNTRIES } from '../store/regionStore';
import type { FeatureCollection, Feature } from 'geojson';

const cesiumToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
if (cesiumToken) Ion.defaultAccessToken = cesiumToken;

// ─── Country centroid lookup (lon, lat) ──────────────────────────────────────
const CENTROIDS: Record<string, [number, number]> = {
  USA: [-98, 38],   CHN: [104, 35],   RUS: [105, 61],   IND: [78, 22],
  GBR: [-2, 54],    DEU: [10, 51],    FRA: [2, 46],     JPN: [138, 37],
  BRA: [-53, -14],  AUS: [133, -27],  CAN: [-96, 60],   KOR: [128, 37],
  MEX: [-102, 23],  IDN: [118, -2],   TUR: [35, 39],    SAU: [45, 24],
  ZAF: [25, -29],   NGA: [8, 10],     PAK: [69, 30],    UKR: [32, 49],
  ITA: [12, 42],    ESP: [-3, 40],    POL: [20, 52],    ARG: [-64, -34],
  COL: [-74, 4],    EGY: [30, 26],    IRN: [53, 32],    THA: [101, 15],
  VNM: [108, 16],   PHL: [122, 12],   BGD: [90, 24],    SWE: [18, 62],
  NOR: [10, 64],    FIN: [26, 64],    NLD: [5, 52],     BEL: [4, 51],
  CHE: [8, 47],     AUT: [14, 47],    PRT: [-8, 39],    GRC: [22, 39],
  ISR: [35, 31],    IRQ: [44, 33],    MAR: [-7, 32],    DZA: [3, 28],
  ETH: [40, 9],     KEN: [38, 1],     TZA: [35, -6],    GHA: [-2, 8],
  MMR: [96, 21],    KHM: [105, 12],   AFG: [67, 33],    YEM: [48, 15],
  ARE: [54, 24],    KWT: [47, 29],    QAT: [51, 25],    JOR: [36, 31],
  KAZ: [67, 48],    UZB: [63, 41],    MNG: [103, 46],   SGP: [104, 1],
  MYS: [110, 4],    SDN: [30, 15],    MOZ: [35, -18],   CMR: [12, 6],
};

const COUNTRY_NAMES: Record<string, string> = {
  USA: 'United States',   CHN: 'China',         RUS: 'Russia',
  IND: 'India',           GBR: 'United Kingdom',DEU: 'Germany',
  FRA: 'France',          JPN: 'Japan',         BRA: 'Brazil',
  AUS: 'Australia',       CAN: 'Canada',        KOR: 'South Korea',
  MEX: 'Mexico',          IDN: 'Indonesia',     TUR: 'Turkey',
  SAU: 'Saudi Arabia',    ZAF: 'South Africa',  NGA: 'Nigeria',
  PAK: 'Pakistan',        UKR: 'Ukraine',       ITA: 'Italy',
  ESP: 'Spain',           POL: 'Poland',        ARG: 'Argentina',
  COL: 'Colombia',        EGY: 'Egypt',         IRN: 'Iran',
  THA: 'Thailand',        VNM: 'Vietnam',       PHL: 'Philippines',
  BGD: 'Bangladesh',      SWE: 'Sweden',        NOR: 'Norway',
  FIN: 'Finland',         NLD: 'Netherlands',   BEL: 'Belgium',
  CHE: 'Switzerland',     AUT: 'Austria',       PRT: 'Portugal',
  GRC: 'Greece',          ISR: 'Israel',        IRQ: 'Iraq',
  MAR: 'Morocco',         DZA: 'Algeria',       ETH: 'Ethiopia',
  KEN: 'Kenya',           TZA: 'Tanzania',      GHA: 'Ghana',
  MMR: 'Myanmar',         KHM: 'Cambodia',      AFG: 'Afghanistan',
  YEM: 'Yemen',           ARE: 'UAE',           KWT: 'Kuwait',
  QAT: 'Qatar',           JOR: 'Jordan',        KAZ: 'Kazakhstan',
  UZB: 'Uzbekistan',      MNG: 'Mongolia',      SGP: 'Singapore',
  MYS: 'Malaysia',        SDN: 'Sudan',         MOZ: 'Mozambique',
  CMR: 'Cameroon',
};

// Event arc colors by type
const ARC_COLORS: Record<string, Color> = {
  sanction:           Color.RED.withAlpha(0.85),
  trade_deal:         Color.GOLD.withAlpha(0.85),
  military_posture:   Color.ORANGE.withAlpha(0.85),
  diplomatic_protest: Color.YELLOW.withAlpha(0.85),
  alliance_formed:    Color.CYAN.withAlpha(0.85),
  alliance_broken:    Color.HOTPINK.withAlpha(0.85),
  conflict_risk:      Color.RED.withAlpha(0.95),
};

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

// ─── Choropleth helpers ───────────────────────────────────────────────────────
function choroplethColor(value: number | undefined, min: number, max: number): Color {
  if (value === undefined || max === min) return Color.GRAY.withAlpha(0.6);
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return Color.fromHsl((1 - t) * 0.33, 0.8, 0.45, 0.75);
}

// ─── Tooltip overlay ─────────────────────────────────────────────────────────
interface TooltipState { iso3: string; x: number; y: number }

function Tooltip({ tip, mode, values }: {
  tip: TooltipState;
  mode: ChoroplethMode;
  values: Map<string, number>;
}) {
  const name = COUNTRY_NAMES[tip.iso3] ?? tip.iso3;
  const val  = values.get(tip.iso3);
  const modeLabel = CHOROPLETH_LABELS[mode];
  const valStr = val !== undefined
    ? mode === 'gdp_per_capita'
      ? `$${Math.round(val).toLocaleString()}`
      : `${val.toFixed(1)}%`
    : '—';

  return (
    <div style={{
      position:     'absolute',
      left:         tip.x + 14,
      top:          tip.y - 10,
      pointerEvents:'none',
      background:   'rgba(10,10,20,0.92)',
      border:       '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8,
      padding:      '8px 12px',
      color:        '#fff',
      fontSize:     12,
      zIndex:       20,
      maxWidth:     200,
      boxShadow:    '0 4px 16px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{name}</div>
      <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 4 }}>{tip.iso3}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: '#9ca3af' }}>{modeLabel.split(' (')[0]}</span>
        <span style={{ fontWeight: 600 }}>{valStr}</span>
      </div>
      <div style={{ color: '#4b5563', fontSize: 10, marginTop: 5 }}>Click to explore →</div>
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
      background:    'rgba(99,102,241,0.15)',
      border:        '1px solid rgba(167,139,250,0.4)',
      borderRadius:  8,
      padding:       '5px 12px',
      fontSize:      11,
      color:         '#a78bfa',
      pointerEvents: 'none',
    }}>
      🔍 Region view — {COUNTRY_NAMES[country] ?? country} · Click a region to inspect
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
  const hoverTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drillCountryRef = useRef<string | null>(null);

  const {
    choroplethValues, choroplethMode, loadChoropleth,
    selectedCountry, worldEvents, pulseCountry, setPulseCountry,
  } = useWorldStore();

  useRegionStore(); // subscribe so RegionPanel re-renders when selection changes
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [drillCountry, setDrillCountry] = useState<string | null>(null);

  // ── Apply choropleth colors ──────────────────────────────────────────────
  const applyColors = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    const vals = Array.from(choroplethValues.values());
    const min  = Math.min(...vals);
    const max  = Math.max(...vals);

    for (const entity of source.entities.values) {
      const iso3 = (entity.properties as Record<string, { getValue: () => string }>)
        ?.['ISO_A3']?.getValue();
      const val  = iso3 ? choroplethValues.get(iso3) : undefined;
      const col  = choroplethColor(val, min, max);
      if (entity.polygon) {
        entity.polygon.material = col as unknown as import('cesium').MaterialProperty;
        entity.polygon.outlineColor = Color.WHITE.withAlpha(0.3) as unknown as import('cesium').Property;
      }
    }
  }, [choroplethValues]);

  useEffect(() => { loadChoropleth(); }, []);
  useEffect(() => { applyColors(); }, [choroplethValues]);

  // ── Camera fly-to when a country is selected ─────────────────────────────
  useEffect(() => {
    if (!selectedCountry || !viewerRef.current) return;
    const centroid = CENTROIDS[selectedCountry];
    if (!centroid) return;
    viewerRef.current.camera.flyTo({
      destination: Cartesian3.fromDegrees(centroid[0], centroid[1], 3_200_000),
      duration: 1.5,
    });
  }, [selectedCountry]);

  // ── Country pulse on player policy save ──────────────────────────────────
  useEffect(() => {
    if (!pulseCountry || !sourceRef.current) return;
    const source = sourceRef.current;
    const vals   = Array.from(choroplethValues.values());
    const min    = Math.min(...vals);
    const max    = Math.max(...vals);

    for (const entity of source.entities.values) {
      const iso3 = (entity.properties as Record<string, { getValue: () => string }>)
        ?.['ISO_A3']?.getValue();
      if (iso3 !== pulseCountry || !entity.polygon) continue;
      entity.polygon.material = Color.WHITE.withAlpha(0.95) as unknown as import('cesium').MaterialProperty;
      const restoreColor = choroplethColor(choroplethValues.get(iso3), min, max);
      setTimeout(() => {
        if (entity.polygon) {
          entity.polygon.material = restoreColor as unknown as import('cesium').MaterialProperty;
        }
        setPulseCountry(null);
      }, 550);
      break;
    }
  }, [pulseCountry]);

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
    });
    viewerRef.current = viewer;

    createWorldTerrainAsync()
      .then((t: CesiumTerrainProvider) => { if (viewerRef.current) viewerRef.current.terrainProvider = t; })
      .catch(() => {});

    // Load country-level GeoJSON
    GeoJsonDataSource.load(
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      { stroke: Color.WHITE.withAlpha(0.4), fill: Color.GRAY.withAlpha(0.6), strokeWidth: 1 }
    ).then(source => {
      viewer.dataSources.add(source);
      sourceRef.current = source;
      applyColors();
    }).catch(() =>
      GeoJsonDataSource.load(
        'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
        { stroke: Color.WHITE.withAlpha(0.4), fill: Color.GRAY.withAlpha(0.6), strokeWidth: 1 }
      ).then(source => {
        viewer.dataSources.add(source);
        sourceRef.current = source;
        applyColors();
      })
    );

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
      const iso3 = props?.['ISO_A3']?.getValue() ?? props?.['iso_a3']?.getValue();
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
      const iso3   = props?.['ISO_A3']?.getValue() ?? props?.['iso_a3']?.getValue();
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
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#000' }} />
      <ChoroplethLegend mode={choroplethMode} />
      {tooltip && (
        <Tooltip tip={tooltip} mode={choroplethMode} values={choroplethValues} />
      )}
      {drillCountry && <DrillBadge country={drillCountry} />}
    </div>
  );
}

// ─── Choropleth legend ────────────────────────────────────────────────────────
const CHOROPLETH_LABELS: Record<ChoroplethMode, string> = {
  gdp_per_capita:   'GDP per Capita (USD)',
  military_spend:   'Military Spend (% GDP)',
  unemployment:     'Unemployment (%)',
  education_spend:  'Education Spend (% GDP)',
  healthcare_spend: 'Healthcare Spend (% GDP)',
  divergence:       'Divergence from Reality',
};

function ChoroplethLegend({ mode }: { mode: ChoroplethMode }) {
  const { setChoroplethMode } = useWorldStore();
  return (
    <div style={{
      position:        'absolute',
      bottom:          32,
      left:            16,
      background:      'rgba(0,0,0,0.75)',
      backdropFilter:  'blur(6px)',
      borderRadius:    10,
      padding:         '12px 16px',
      color:           '#fff',
      fontSize:        12,
      display:         'flex',
      flexDirection:   'column',
      gap:             7,
      minWidth:        195,
      border:          '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af' }}>
        Overlay
      </div>
      {(Object.keys(CHOROPLETH_LABELS) as ChoroplethMode[]).map(m => (
        <label key={m} style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="radio"
            checked={mode === m}
            onChange={() => setChoroplethMode(m)}
            style={{ accentColor: '#6366f1' }}
          />
          <span style={{ color: mode === m ? '#fff' : '#9ca3af' }}>{CHOROPLETH_LABELS[m]}</span>
        </label>
      ))}
      <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#6b7280' }}>
        <span style={{ background: 'hsl(120,80%,45%)', width: 12, height: 12, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
        Low
        <span style={{ flex: 1, height: 4, background: 'linear-gradient(to right,hsl(120,80%,45%),hsl(60,80%,45%),hsl(0,80%,45%))', borderRadius: 2 }} />
        High
        <span style={{ background: 'hsl(0,80%,45%)', width: 12, height: 12, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
      </div>
    </div>
  );
}
