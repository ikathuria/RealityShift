import { useEffect, useRef, useCallback } from 'react';
import {
  Viewer,
  Ion,
  GeoJsonDataSource,
  Color,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Entity,
  createWorldTerrainAsync,
  CesiumTerrainProvider,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useWorldStore } from '../store/worldStore';
import type { ChoroplethMode } from '../store/worldStore';

const cesiumToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
if (cesiumToken) Ion.defaultAccessToken = cesiumToken;

// Quantile color scale: value → Cesium Color (green → yellow → red)
function choroplethColor(value: number | undefined, min: number, max: number): Color {
  if (value === undefined || max === min) return Color.GRAY.withAlpha(0.6);
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // green (low) → yellow (mid) → red (high) — reversed for GDP (high = good)
  return Color.fromHsl((1 - t) * 0.33, 0.8, 0.45, 0.75);
}

export default function Globe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef    = useRef<Viewer | null>(null);
  const sourceRef    = useRef<GeoJsonDataSource | null>(null);
  const handlerRef   = useRef<ScreenSpaceEventHandler | null>(null);

  const { choroplethValues, choroplethMode, loadChoropleth } = useWorldStore();

  // Load choropleth data on first render
  useEffect(() => { loadChoropleth(); }, []);

  // Apply choropleth colors whenever values change
  const applyColors = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;

    const values = Array.from(choroplethValues.values());
    const min = Math.min(...values);
    const max = Math.max(...values);

    for (const entity of source.entities.values) {
      const iso3 = (entity.properties as Record<string, { getValue: () => string }>)
        ?.['ISO_A3']?.getValue();
      const val = iso3 ? choroplethValues.get(iso3) : undefined;
      const color = choroplethColor(val, min, max);
      if (entity.polygon) {
        entity.polygon.material = color as unknown as import('cesium').MaterialProperty;
        entity.polygon.outlineColor = Color.WHITE.withAlpha(0.3) as unknown as import('cesium').Property;
      }
    }
  }, [choroplethValues]);

  useEffect(() => { applyColors(); }, [choroplethValues]);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      creditContainer: document.createElement('div'),
    });
    viewerRef.current = viewer;

    // Attach terrain
    createWorldTerrainAsync()
      .then((t: CesiumTerrainProvider) => { if (viewerRef.current) viewerRef.current.terrainProvider = t; })
      .catch(() => {});

    // Load GeoJSON country boundaries
    // Using TopoJSON via world-atlas npm package (hosted on jsDelivr, public domain)
    GeoJsonDataSource.load(
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      {
        stroke: Color.WHITE.withAlpha(0.4),
        fill: Color.GRAY.withAlpha(0.6),
        strokeWidth: 1,
      }
    ).then(source => {
      viewer.dataSources.add(source);
      sourceRef.current = source;
      applyColors();
    }).catch(err => {
      // Fall back to a known GeoJSON countries endpoint
      console.warn('world-atlas load failed, trying fallback', err);
      return GeoJsonDataSource.load(
        'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
        { stroke: Color.WHITE.withAlpha(0.4), fill: Color.GRAY.withAlpha(0.6), strokeWidth: 1 }
      ).then(source => {
        viewer.dataSources.add(source);
        sourceRef.current = source;
        applyColors();
      });
    });

    // Country click handler
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction((event: { position: import('cesium').Cartesian2 }) => {
      const picked = viewer.scene.pick(event.position);
      if (!defined(picked) || !(picked.id instanceof Entity)) {
        useWorldStore.getState().selectCountry(null);
        return;
      }
      const entity = picked.id as Entity;
      const props = entity.properties as Record<string, { getValue: () => string }> | undefined;
      const iso3 = props?.['ISO_A3']?.getValue() ?? props?.['iso_a3']?.getValue();
      if (iso3) useWorldStore.getState().selectCountry(iso3);
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handlerRef.current?.destroy();
      viewerRef.current?.destroy();
      viewerRef.current = null;
      sourceRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#000' }} />
      <ChoroplethLegend mode={choroplethMode} />
    </div>
  );
}

const CHOROPLETH_LABELS: Record<ChoroplethMode, string> = {
  gdp_per_capita:   'GDP per Capita (USD)',
  military_spend:   'Military Spend (% GDP)',
  unemployment:     'Unemployment (%)',
  education_spend:  'Education Spend (% GDP)',
  healthcare_spend: 'Healthcare Spend (% GDP)',
};

function ChoroplethLegend({ mode }: { mode: ChoroplethMode }) {
  const { setChoroplethMode } = useWorldStore();
  return (
    <div style={{
      position: 'absolute', bottom: 32, left: 16, background: 'rgba(0,0,0,0.7)',
      borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 12,
      display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Overlay</div>
      {(Object.keys(CHOROPLETH_LABELS) as ChoroplethMode[]).map(m => (
        <label key={m} style={{ cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="radio" checked={mode === m} onChange={() => setChoroplethMode(m)} />
          {CHOROPLETH_LABELS[m]}
        </label>
      ))}
      <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ background: 'hsl(120,80%,45%)', width: 14, height: 14, borderRadius: 2, display: 'inline-block' }} />
        <span>Low</span>
        <span style={{ background: 'hsl(0,80%,45%)', width: 14, height: 14, borderRadius: 2, marginLeft: 8, display: 'inline-block' }} />
        <span>High</span>
      </div>
    </div>
  );
}
