import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RoadNetwork } from '../simulation/traffic/network';
import type { TrafficState } from '../simulation/traffic/engine';
import { CONGESTION_LEVELS } from '../config/traffic';
import { env } from '../config/env';

// Vite needs an explicit module-worker URL for MapLibre. Without it the map
// container renders but the worker can fail to initialize in Chromium.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

interface TrafficMapProps {
  network: RoadNetwork;
  traffic: TrafficState;
  center: [number, number];
  selectedSegmentIndex: number | null;
  corridorIndices: number[];
  onSelectSegment: (index: number) => void;
}

export const TrafficMap = ({
  network,
  traffic,
  center,
  selectedSegmentIndex,
  corridorIndices,
  onSelectSegment,
}: TrafficMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isLoadedRef = useRef(false);
  const onSelectSegmentRef = useRef(onSelectSegment);
  useEffect(() => {
    onSelectSegmentRef.current = onSelectSegment;
  }, [onSelectSegment]);

  const updateFeatureStates = (map: maplibregl.Map) => {
    const draftSet = new Set(corridorIndices);
    for (let i = 0; i < network.segments.length; i++) {
      const congestion = traffic.congestion[i] ?? 0;
      map.setFeatureState(
        { source: 'roads', id: i },
        {
          congestion,
          selected: selectedSegmentIndex === i,
          inDraft: draftSet.has(i),
        },
      );
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: env.mapStyleUrl,
      center,
      zoom: 12.5,
      minZoom: 10,
      maxZoom: 18,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      isLoadedRef.current = true;

      // Construct GeoJSON FeatureCollection
      const geojson: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: 'FeatureCollection',
        features: network.segments.map((seg) => ({
          type: 'Feature',
          id: seg.index,
          properties: {
            index: seg.index,
            id: seg.id,
            name: seg.name,
            roadType: seg.roadType,
            lanes: seg.lanes,
          },
          geometry: {
            type: 'LineString',
            coordinates: seg.coordinates,
          },
        })),
      };

      map.addSource('roads', {
        type: 'geojson',
        data: geojson,
        promoteId: 'index',
      });

      // Layer: Base Road Network (casing / width based on roadType)
      map.addLayer({
        id: 'roads-base',
        type: 'line',
        source: 'roads',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#1f2937',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            ['match', ['get', 'roadType'], 'motorway', 3, 'trunk', 2.5, 'primary', 2, 1],
            15,
            ['match', ['get', 'roadType'], 'motorway', 8, 'trunk', 7, 'primary', 6, 'secondary', 4, 3],
          ],
        },
      });

      // Layer: Traffic Congestion Coloring
      map.addLayer({
        id: 'roads-traffic',
        type: 'line',
        source: 'roads',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#00f0ff',
            ['boolean', ['feature-state', 'inDraft'], false],
            '#38bdf8',
            [
              'interpolate',
              ['linear'],
              ['coalesce', ['feature-state', 'congestion'], 0],
              0.0,
              CONGESTION_LEVELS[0].color,
              0.4,
              CONGESTION_LEVELS[1].color,
              0.6,
              CONGESTION_LEVELS[2].color,
              0.8,
              CONGESTION_LEVELS[3].color,
              1.0,
              CONGESTION_LEVELS[4].color,
            ],
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            ['match', ['get', 'roadType'], 'motorway', 2, 'trunk', 1.5, 1],
            15,
            [
              'case',
              [
                'any',
                ['boolean', ['feature-state', 'selected'], false],
                ['boolean', ['feature-state', 'inDraft'], false],
              ],
              7,
              ['match', ['get', 'roadType'], 'motorway', 6, 'trunk', 5, 'primary', 4, 'secondary', 3, 2],
            ],
          ],
        },
      });

      // Hover / Click interaction
      map.on('click', 'roads-traffic', (e: maplibregl.MapLayerMouseEvent) => {
        if (e.features && e.features[0]) {
          const index = Number(e.features[0].id);
          onSelectSegmentRef.current(index);
        }
      });

      map.on('mouseenter', 'roads-traffic', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'roads-traffic', () => {
        map.getCanvas().style.cursor = '';
      });

      // Initial state sync
      updateFeatureStates(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, center]);

  // Update feature-state when traffic, selection, or draft corridor changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
    updateFeatureStates(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traffic, selectedSegmentIndex, corridorIndices]);

  return (
    <div
      ref={mapContainer}
      // Do not rely on Tailwind utilities here: this project ships its own CSS.
      // MapLibre needs a non-zero container size before it can render.
      style={{ position: 'absolute', top: '68px', right: 0, bottom: 0, left: 0 }}
      role="region"
      aria-label="Simulated traffic map of Lima"
    />
  );
};
