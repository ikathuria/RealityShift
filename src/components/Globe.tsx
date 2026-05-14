import { useEffect, useRef } from 'react';
import {
  Viewer,
  Ion,
  createWorldTerrainAsync,
  CesiumTerrainProvider,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Set the Cesium Ion token from environment variables.
// Terrain and imagery still work with the default token; set your own for higher quotas.
const cesiumToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
if (cesiumToken) {
  Ion.defaultAccessToken = cesiumToken;
}

export default function Globe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

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
      creditContainer: document.createElement('div'), // hide Cesium credits overlay
    });

    viewerRef.current = viewer;

    // Attach terrain asynchronously — fine if this fails (no token)
    createWorldTerrainAsync()
      .then((terrain: CesiumTerrainProvider) => {
        if (viewerRef.current) {
          viewerRef.current.terrainProvider = terrain;
        }
      })
      .catch(() => {
        // Fall back to default ellipsoid terrain — globe still renders
      });

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100vh', background: '#000' }}
    />
  );
}
