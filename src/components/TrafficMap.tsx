import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RoadNetwork } from '../simulation/traffic/network';
import type { TrafficState } from '../simulation/traffic/engine';
import type { CityTransitDataset } from '../data/cityDataset';
import type { Project } from '../simulation/state';
import { CONGESTION_LEVELS } from '../config/traffic';
import { env } from '../config/env';
import {
  LIMA_CAMERA_BOUNDS,
  LIMA_INVERTED_MASK,
  LIMA_PERIMETER_LINE,
} from '../data/jurisdictionBoundary';

// Explicit worker URL for MapLibre
maplibregl.setWorkerUrl(maplibreWorkerUrl);

interface TrafficMapProps {
  network: RoadNetwork;
  traffic: TrafficState;
  transit?: CityTransitDataset;
  activeProjects?: readonly Project[];
  center: [number, number];
  selectedSegmentIndices: number[];
  corridorIndices: number[];
  mapLayerMode?: 'surface' | 'subterranean';
  isDraftingSubway?: boolean;
  subwayDraftStations?: Array<{ name: string; coordinates: [number, number] }>;
  onSelectSegment: (index: number | null) => void;
  onDoubleClickSegment?: (index: number) => void;
  onAddSubwayStation?: (lngLat: [number, number]) => void;
}

export const TrafficMap = ({
  network,
  traffic,
  transit,
  activeProjects = [],
  center,
  selectedSegmentIndices,
  corridorIndices,
  mapLayerMode = 'surface',
  isDraftingSubway = false,
  subwayDraftStations = [],
  onSelectSegment,
  onDoubleClickSegment,
  onAddSubwayStation,
}: TrafficMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isLoadedRef = useRef(false);
  const onSelectSegmentRef = useRef(onSelectSegment);
  const onDoubleClickSegmentRef = useRef(onDoubleClickSegment);
  const onAddSubwayStationRef = useRef(onAddSubwayStation);
  const isDraftingSubwayRef = useRef(isDraftingSubway);

  useEffect(() => {
    onSelectSegmentRef.current = onSelectSegment;
  }, [onSelectSegment]);

  useEffect(() => {
    onDoubleClickSegmentRef.current = onDoubleClickSegment;
  }, [onDoubleClickSegment]);

  useEffect(() => {
    onAddSubwayStationRef.current = onAddSubwayStation;
  }, [onAddSubwayStation]);

  useEffect(() => {
    isDraftingSubwayRef.current = isDraftingSubway;
    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = isDraftingSubway ? 'crosshair' : '';
    }
  }, [isDraftingSubway]);

  const updateFeatureStates = (map: maplibregl.Map) => {
    const selectedSet = new Set(selectedSegmentIndices);
    const draftSet = new Set(corridorIndices);
    for (let i = 0; i < network.segments.length; i++) {
      const congestion = traffic.congestion[i] ?? 0;
      map.setFeatureState(
        { source: 'roads', id: i },
        {
          congestion,
          selected: selectedSet.has(i),
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
      zoom: 13,
      minZoom: 11.2,
      maxZoom: 18,
      maxBounds: LIMA_CAMERA_BOUNDS,
      attributionControl: { compact: true },
    });

    // Navigation control positioned cleanly at bottom-right
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    map.on('load', () => {
      isLoadedRef.current = true;

      // Construct GeoJSON FeatureCollection with all real road segments
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

      // Layer 1: Road Casing (subtle dark border)
      map.addLayer({
        id: 'roads-casing',
        type: 'line',
        source: 'roads',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#090d0b',
          'line-opacity': 0.85,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            ['match', ['get', 'roadType'], 'motorway', 3.5, 'trunk', 3, 'primary', 2.5, 1.8],
            14,
            ['match', ['get', 'roadType'], 'motorway', 6.5, 'trunk', 5.5, 'primary', 4.5, 'secondary', 3.5, 2.5],
            17,
            ['match', ['get', 'roadType'], 'motorway', 12, 'trunk', 10, 'primary', 8, 'secondary', 6, 4],
          ],
        },
      });

      // Layer 2: Google Maps Style Traffic Flow Overlay
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
            '#00f0ff', // Selected segment highlight (Cyan)
            ['boolean', ['feature-state', 'inDraft'], false],
            '#38bdf8', // Draft corridor highlight (Sky Blue)
            [
              'interpolate',
              ['linear'],
              ['coalesce', ['feature-state', 'congestion'], 0],
              0.0,
              CONGESTION_LEVELS[0].color, // Green (#22c55e)
              0.35,
              CONGESTION_LEVELS[1].color, // Yellow (#eab308)
              0.60,
              CONGESTION_LEVELS[2].color, // Orange (#f97316)
              0.80,
              CONGESTION_LEVELS[3].color, // Red (#ef4444)
              1.00,
              CONGESTION_LEVELS[4].color, // Dark red (#7f1d1d)
            ],
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            [
              'case',
              [
                'any',
                ['boolean', ['feature-state', 'selected'], false],
                ['boolean', ['feature-state', 'inDraft'], false],
              ],
              4,
              ['match', ['get', 'roadType'], 'motorway', 2.2, 'trunk', 1.8, 'primary', 1.5, 1.0],
            ],
            14,
            [
              'case',
              [
                'any',
                ['boolean', ['feature-state', 'selected'], false],
                ['boolean', ['feature-state', 'inDraft'], false],
              ],
              7,
              ['match', ['get', 'roadType'], 'motorway', 4.8, 'trunk', 3.8, 'primary', 3.0, 'secondary', 2.2, 1.5],
            ],
            17,
            [
              'case',
              [
                'any',
                ['boolean', ['feature-state', 'selected'], false],
                ['boolean', ['feature-state', 'inDraft'], false],
              ],
              12,
              ['match', ['get', 'roadType'], 'motorway', 9, 'trunk', 7.5, 'primary', 6, 'secondary', 4.5, 3],
            ],
          ],
        },
      });

      // Layer 3: Existing Public Transit Network (Metro Línea 1, Metropolitano BRT, Corredores)
      if (transit && transit.routes.length > 0) {
        const transitFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        for (const r of transit.routes) {
          for (let i = 0; i < r.lines.length; i++) {
            transitFeatures.push({
              type: 'Feature',
              properties: {
                id: r.id,
                name: r.name,
                mode: r.mode,
                ref: r.ref,
                color: r.colour || '#00e676',
              },
              geometry: {
                type: 'LineString',
                coordinates: r.lines[i],
              },
            });
          }
        }

        map.addSource('transit-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: transitFeatures,
          },
        });

        map.addLayer({
          id: 'transit-casing',
          type: 'line',
          source: 'transit-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#020617',
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4.5, 15, 8],
            'line-opacity': 0.85,
          },
        });

        map.addLayer({
          id: 'transit-lines',
          type: 'line',
          source: 'transit-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 15, 5],
          },
        });
      }

      // Subterranean background wash: dims the ground when in subterranean mode
      map.addSource('subterranean-wash-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-180, -85],
                [180, -85],
                [180, 85],
                [-180, 85],
                [-180, -85],
              ],
            ],
          },
        },
      });

      map.addLayer({
        id: 'subterranean-wash',
        type: 'fill',
        source: 'subterranean-wash-src',
        paint: {
          'fill-color': '#050c12',
          'fill-opacity': mapLayerMode === 'subterranean' ? 0.65 : 0.0,
        },
      });

      // Exterior Fog of War / Jurisdiction Boundary Mask
      map.addSource('jurisdiction-mask', {
        type: 'geojson',
        data: LIMA_INVERTED_MASK,
      });

      map.addLayer({
        id: 'jurisdiction-mask-fill',
        type: 'fill',
        source: 'jurisdiction-mask',
        paint: {
          'fill-color': '#030705',
          'fill-opacity': 0.82,
        },
      });

      map.addSource('jurisdiction-line', {
        type: 'geojson',
        data: LIMA_PERIMETER_LINE,
      });

      map.addLayer({
        id: 'jurisdiction-line-glow',
        type: 'line',
        source: 'jurisdiction-line',
        paint: {
          'line-color': '#00f0ff',
          'line-width': 4,
          'line-opacity': 0.35,
          'line-blur': 3,
        },
      });

      map.addLayer({
        id: 'jurisdiction-line-dash',
        type: 'line',
        source: 'jurisdiction-line',
        paint: {
          'line-color': '#00f0ff',
          'line-width': 1.8,
          'line-dasharray': [3, 2],
          'line-opacity': 0.85,
        },
      });

      // Player-built subway lines and stations
      map.addSource('player-subways-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'player-subways-casing',
        type: 'line',
        source: 'player-subways-source',
        filter: ['==', '$type', 'LineString'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#02151f',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 6, 15, 10],
          'line-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'player-subways-line',
        type: 'line',
        source: 'player-subways-source',
        filter: ['==', '$type', 'LineString'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#00f0ff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 15, 6],
        },
      });

      map.addLayer({
        id: 'player-subways-stations',
        type: 'circle',
        source: 'player-subways-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 8],
          'circle-color': '#ffffff',
          'circle-stroke-color': '#00f0ff',
          'circle-stroke-width': 2.5,
        },
      });

      // Subway freeform drafting (live preview during tunnel boring)
      map.addSource('subway-draft-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'subway-draft-tunnel-glow',
        type: 'line',
        source: 'subway-draft-source',
        filter: ['==', '$type', 'LineString'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#a855f7',
          'line-width': 8,
          'line-opacity': 0.45,
          'line-blur': 4,
        },
      });

      map.addLayer({
        id: 'subway-draft-tunnel-line',
        type: 'line',
        source: 'subway-draft-source',
        filter: ['==', '$type', 'LineString'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#e879f9',
          'line-width': 4,
          'line-dasharray': [2, 1],
        },
      });

      map.addLayer({
        id: 'subway-draft-stations',
        type: 'circle',
        source: 'subway-draft-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 15, 9],
          'circle-color': '#fdf4ff',
          'circle-stroke-color': '#c084fc',
          'circle-stroke-width': 3,
        },
      });

      // Disable doubleClickZoom so double-clicking road selects the whole avenue instead of zooming
      map.doubleClickZoom.disable();

      let lastClickTime = 0;
      let lastClickedIndex: number | null = null;

      // Map Click: select segment if clicked, or detect double click, or add subway station if drafting!
      map.on('click', (e: maplibregl.MapLayerMouseEvent) => {
        // In freeform subway mode, click anywhere places an underground station!
        if (isDraftingSubwayRef.current) {
          onAddSubwayStationRef.current?.([e.lngLat.lng, e.lngLat.lat]);
          return;
        }

        const features = map.queryRenderedFeatures(e.point, { layers: ['roads-traffic'] });
        if (features && features.length > 0 && features[0].id !== undefined) {
          const index = Number(features[0].id);
          const now = Date.now();
          // If clicking the same segment again within 450ms, treat as double-click (selects entire avenue)
          if (lastClickedIndex === index && now - lastClickTime < 450) {
            onDoubleClickSegmentRef.current?.(index);
            lastClickTime = 0;
            lastClickedIndex = null;
          } else {
            lastClickTime = now;
            lastClickedIndex = index;
            onSelectSegmentRef.current(index);
          }
        } else {
          lastClickTime = 0;
          lastClickedIndex = null;
          // Clicked empty area on the map: deselect!
          onSelectSegmentRef.current(null);
        }
      });

      // Native MapLibre dblclick event on roads
      map.on('dblclick', 'roads-traffic', (e: maplibregl.MapLayerMouseEvent) => {
        if (isDraftingSubwayRef.current) return;
        if (e.features && e.features.length > 0 && e.features[0].id !== undefined) {
          const index = Number(e.features[0].id);
          onDoubleClickSegmentRef.current?.(index);
        }
      });

      map.on('mouseenter', 'roads-traffic', () => {
        if (!isDraftingSubwayRef.current) {
          map.getCanvas().style.cursor = 'pointer';
        }
      });

      map.on('mouseleave', 'roads-traffic', () => {
        if (!isDraftingSubwayRef.current) {
          map.getCanvas().style.cursor = '';
        }
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
  }, [network, center, transit]);

  // Sync player-built subways on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
    const src = map.getSource('player-subways-source') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      const features: GeoJSON.Feature[] = [];
      for (const p of activeProjects) {
        if (p.typeId === 'subway' && p.subwayAlignment && p.subwayAlignment.length >= 2) {
          features.push({
            type: 'Feature',
            properties: { id: p.id, name: p.name, phase: p.phase },
            geometry: {
              type: 'LineString',
              coordinates: p.subwayAlignment,
            },
          });
          for (const st of p.subwayStations ?? []) {
            features.push({
              type: 'Feature',
              properties: { id: p.id, name: st.name },
              geometry: {
                type: 'Point',
                coordinates: st.coordinates,
              },
            });
          }
        }
      }
      src.setData({ type: 'FeatureCollection', features });
    }
  }, [activeProjects]);

  // Sync freeform subway drafting preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
    const src = map.getSource('subway-draft-source') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      const features: GeoJSON.Feature[] = [];
      const coords = subwayDraftStations.map((s) => s.coordinates);
      if (coords.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { type: 'tunnel' },
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        });
      }
      for (let i = 0; i < subwayDraftStations.length; i++) {
        features.push({
          type: 'Feature',
          properties: {
            name: subwayDraftStations[i].name,
            index: i + 1,
          },
          geometry: {
            type: 'Point',
            coordinates: subwayDraftStations[i].coordinates,
          },
        });
      }
      src.setData({ type: 'FeatureCollection', features });
    }
  }, [subwayDraftStations]);

  // Adjust layer opacities when switching between Surface and Subterranean mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
    if (mapLayerMode === 'subterranean') {
      if (map.getLayer('roads-traffic')) map.setPaintProperty('roads-traffic', 'line-opacity', 0.18);
      if (map.getLayer('roads-casing')) map.setPaintProperty('roads-casing', 'line-opacity', 0.12);
      if (map.getLayer('subterranean-wash')) map.setPaintProperty('subterranean-wash', 'fill-opacity', 0.65);
    } else {
      if (map.getLayer('roads-traffic')) map.setPaintProperty('roads-traffic', 'line-opacity', 1.0);
      if (map.getLayer('roads-casing')) map.setPaintProperty('roads-casing', 'line-opacity', 0.85);
      if (map.getLayer('subterranean-wash')) map.setPaintProperty('subterranean-wash', 'fill-opacity', 0.0);
    }
  }, [mapLayerMode]);

  // Update feature-state when traffic, selection, or draft corridor changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
    updateFeatureStates(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traffic, selectedSegmentIndices, corridorIndices, activeProjects]);

  return (
    <div
      ref={mapContainer}
      style={{ position: 'absolute', top: '68px', right: 0, bottom: 0, left: 0 }}
      role="region"
      aria-label="Simulated traffic map of Lima"
    />
  );
};
