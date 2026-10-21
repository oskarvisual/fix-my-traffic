import { useEffect, useMemo, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RoadNetwork } from '../simulation/traffic/network';
import type { TrafficState } from '../simulation/traffic/engine';
import type { CityTransitDataset } from '../data/cityDataset';
import type { Project } from '../simulation/state';
import { CONGESTION_LEVELS } from '../config/traffic';
import { env } from '../config/env';
import { getCityJurisdiction } from '../data/jurisdictionBoundary';

// Explicit worker URL for MapLibre
maplibregl.setWorkerUrl(maplibreWorkerUrl);

interface TrafficMapProps {
  cityId?: string;
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
  cityId,
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
  const jurisdiction = useMemo(() => getCityJurisdiction(cityId ?? 'lima'), [cityId]);
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

  const constructionSegmentSet = useMemo(() => {
    const set = new Set<number>();
    const activeBuilding = activeProjects.filter((p) => p.phase === 'construction');
    if (activeBuilding.length === 0) return set;
    const idMap = new Map(network.segments.map((s) => [s.id, s.index]));
    for (const p of activeBuilding) {
      for (const segId of p.segmentIds) {
        const idx = idMap.get(segId);
        if (idx !== undefined) set.add(idx);
      }
    }
    return set;
  }, [activeProjects, network]);

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
          underConstruction: constructionSegmentSet.has(i),
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
      minZoom: jurisdiction.minZoom,
      maxZoom: 18,
      maxBounds: jurisdiction.cameraBounds,
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

      // Layer 0: Hover Halo Glow (cyan aura when hovering over any road)
      map.addLayer({
        id: 'roads-hover-halo',
        type: 'line',
        source: 'roads',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#00f0ff',
          'line-blur': 3,
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.0,
            ['boolean', ['feature-state', 'hover'], false],
            0.8,
            0.0,
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            8,
            14,
            13,
            17,
            20,
          ],
        },
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
            ['match', ['get', 'roadType'], 'motorway', 4.5, 'trunk', 4, 'primary', 3.5, 2.5],
            14,
            ['match', ['get', 'roadType'], 'motorway', 8, 'trunk', 7, 'primary', 5.5, 'secondary', 4.5, 3.5],
            17,
            ['match', ['get', 'roadType'], 'motorway', 14, 'trunk', 12, 'primary', 10, 'secondary', 8, 6],
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
            ['boolean', ['feature-state', 'underConstruction'], false],
            '#f97316', // Construction works (Hazard Orange)
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
                ['boolean', ['feature-state', 'underConstruction'], false],
              ],
              5,
              ['match', ['get', 'roadType'], 'motorway', 3.0, 'trunk', 2.5, 'primary', 2.0, 1.4],
            ],
            14,
            [
              'case',
              [
                'any',
                ['boolean', ['feature-state', 'selected'], false],
                ['boolean', ['feature-state', 'inDraft'], false],
                ['boolean', ['feature-state', 'underConstruction'], false],
              ],
              8,
              ['match', ['get', 'roadType'], 'motorway', 5.8, 'trunk', 4.8, 'primary', 3.8, 'secondary', 2.8, 2.0],
            ],
            17,
            [
              'case',
              [
                'any',
                ['boolean', ['feature-state', 'selected'], false],
                ['boolean', ['feature-state', 'inDraft'], false],
                ['boolean', ['feature-state', 'underConstruction'], false],
              ],
              14,
              ['match', ['get', 'roadType'], 'motorway', 10.5, 'trunk', 9, 'primary', 7.5, 'secondary', 6, 4],
            ],
          ],
        },
      });

      // Layer 2B: Hazard Barricade Stripes for Roads Under Construction
      map.addLayer({
        id: 'roads-construction-hazard',
        type: 'line',
        source: 'roads',
        layout: {
          'line-join': 'round',
          'line-cap': 'butt',
        },
        paint: {
          'line-color': '#180a02',
          'line-dasharray': [1.2, 1.2],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'underConstruction'], false],
            0.9,
            0.0,
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            3,
            14,
            6,
            17,
            11,
          ],
        },
      });

      // Layer 2C: Generous Invisible Hit Target for Road Hover & Selection
      map.addLayer({
        id: 'roads-hit-target',
        type: 'line',
        source: 'roads',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#000000',
          'line-opacity': 0.001,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            16,
            14,
            24,
            17,
            36,
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
                subterranean: !!r.subterranean,
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
        data: jurisdiction.invertedMask,
      });

      map.addLayer({
        id: 'jurisdiction-mask-fill',
        type: 'fill',
        source: 'jurisdiction-mask',
        paint: {
          'fill-color': '#030705',
          'fill-opacity': 0.45,
        },
      });

      map.addSource('jurisdiction-line', {
        type: 'geojson',
        data: jurisdiction.perimeterLine,
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

      // Existing Subterranean Transit Lines (Pre-existing real-world Subways/Metros)
      // Rendered above the subterranean wash so they glow when toggled to Underground mode!
      if (transit && transit.routes.length > 0) {
        map.addLayer({
          id: 'transit-subterranean-casing',
          type: 'line',
          source: 'transit-source',
          filter: ['==', ['get', 'subterranean'], true],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#020617',
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 6, 15, 10],
            'line-opacity': mapLayerMode === 'subterranean' ? 0.95 : 0.0,
          },
        });

        map.addLayer({
          id: 'transit-subterranean-glow',
          type: 'line',
          source: 'transit-source',
          filter: ['==', ['get', 'subterranean'], true],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 8, 15, 14],
            'line-blur': 3,
            'line-opacity': mapLayerMode === 'subterranean' ? 0.65 : 0.0,
          },
        });

        map.addLayer({
          id: 'transit-subterranean-lines',
          type: 'line',
          source: 'transit-source',
          filter: ['==', ['get', 'subterranean'], true],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 15, 6],
            'line-opacity': mapLayerMode === 'subterranean' ? 1.0 : 0.0,
          },
        });
      }

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

      let hoveredIndex: number | null = null;

      const setHoveredSegment = (index: number | null) => {
        if (hoveredIndex === index) return;
        if (hoveredIndex !== null) {
          map.setFeatureState({ source: 'roads', id: hoveredIndex }, { hover: false });
        }
        hoveredIndex = index;
        if (index !== null) {
          map.setFeatureState({ source: 'roads', id: index }, { hover: true });
          if (!isDraftingSubwayRef.current) {
            map.getCanvas().style.cursor = 'pointer';
          }
        } else {
          if (!isDraftingSubwayRef.current) {
            map.getCanvas().style.cursor = '';
          }
        }
      };

      // Hover detection on wide hit-target layer
      map.on('mousemove', 'roads-hit-target', (e: maplibregl.MapLayerMouseEvent) => {
        if (isDraftingSubwayRef.current) return;
        if (e.features && e.features.length > 0 && e.features[0].id !== undefined) {
          setHoveredSegment(Number(e.features[0].id));
        }
      });

      map.on('mouseleave', 'roads-hit-target', () => {
        setHoveredSegment(null);
      });

      map.on('mouseout', () => {
        setHoveredSegment(null);
      });

      let lastClickTime = 0;
      let lastClickedIndex: number | null = null;

      // Map Click: select segment if clicked, or detect double click, or add subway station if drafting!
      map.on('click', (e: maplibregl.MapLayerMouseEvent) => {
        // In freeform subway mode, click anywhere places an underground station!
        if (isDraftingSubwayRef.current) {
          onAddSubwayStationRef.current?.([e.lngLat.lng, e.lngLat.lat]);
          return;
        }

        // Query click on hit target (roads-hit-target already provides generous 16-36px line width)
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['roads-hit-target', 'roads-traffic'],
        });

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
      map.on('dblclick', 'roads-hit-target', (e: maplibregl.MapLayerMouseEvent) => {
        if (isDraftingSubwayRef.current) return;
        if (e.features && e.features.length > 0 && e.features[0].id !== undefined) {
          const index = Number(e.features[0].id);
          onDoubleClickSegmentRef.current?.(index);
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
  }, [network, center, transit, jurisdiction]);

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
      if (map.getLayer('roads-construction-hazard')) map.setPaintProperty('roads-construction-hazard', 'line-opacity', 0.0);
      if (map.getLayer('subterranean-wash')) map.setPaintProperty('subterranean-wash', 'fill-opacity', 0.65);
      if (map.getLayer('transit-subterranean-casing')) map.setPaintProperty('transit-subterranean-casing', 'line-opacity', 0.95);
      if (map.getLayer('transit-subterranean-glow')) map.setPaintProperty('transit-subterranean-glow', 'line-opacity', 0.65);
      if (map.getLayer('transit-subterranean-lines')) map.setPaintProperty('transit-subterranean-lines', 'line-opacity', 1.0);
    } else {
      if (map.getLayer('roads-traffic')) map.setPaintProperty('roads-traffic', 'line-opacity', 1.0);
      if (map.getLayer('roads-casing')) map.setPaintProperty('roads-casing', 'line-opacity', 0.85);
      if (map.getLayer('roads-construction-hazard')) {
        map.setPaintProperty('roads-construction-hazard', 'line-opacity', [
          'case',
          ['boolean', ['feature-state', 'underConstruction'], false],
          0.9,
          0.0,
        ]);
      }
      if (map.getLayer('subterranean-wash')) map.setPaintProperty('subterranean-wash', 'fill-opacity', 0.0);
      if (map.getLayer('transit-subterranean-casing')) map.setPaintProperty('transit-subterranean-casing', 'line-opacity', 0.0);
      if (map.getLayer('transit-subterranean-glow')) map.setPaintProperty('transit-subterranean-glow', 'line-opacity', 0.0);
      if (map.getLayer('transit-subterranean-lines')) map.setPaintProperty('transit-subterranean-lines', 'line-opacity', 0.0);
    }
  }, [mapLayerMode]);

  const constructionMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Spawn visual closed road and detour markers (🚧 ↪️ 🦺 ⚠️) on roads under construction
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    // Clear previous construction markers
    constructionMarkersRef.current.forEach((m) => m.remove());
    constructionMarkersRef.current = [];

    const activeBuilding = activeProjects.filter((p) => p.phase === 'construction');
    if (activeBuilding.length === 0) return;

    const idMap = new Map(network.segments.map((s) => [s.id, s]));

    for (const project of activeBuilding) {
      const segs = project.segmentIds
        .map((id) => idMap.get(id))
        .filter((s): s is (typeof network.segments)[0] => s !== undefined);

      if (segs.length === 0) continue;

      // 1. Entry / Start of corridor: 🚧 ROAD CLOSED
      const firstSeg = segs[0];
      const startCoord = firstSeg.coordinates[0];
      if (startCoord) {
        const el = document.createElement('div');
        el.className = 'fmt-construction-badge';
        el.innerHTML = `<span class="fmt-badge-emoji">🚧</span><span class="fmt-badge-text">ROAD CLOSED</span>`;
        el.title = `🚧 Road closed for construction of "${project.name}". Vehicular traffic diverted to detour routes.`;
        el.onclick = (e) => {
          e.stopPropagation();
          onSelectSegmentRef.current(firstSeg.index);
        };
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(startCoord as [number, number])
          .addTo(map);
        constructionMarkersRef.current.push(marker);
      }

      // 2. Intermediate points: alternating 🦺 ROADWORK and ⚠️ MACHINERY / DETOUR
      const step = Math.max(1, Math.floor(segs.length / 3));
      for (let i = step; i < segs.length; i += step) {
        const seg = segs[i];
        const midIdx = Math.floor(seg.coordinates.length / 2);
        const midCoord = seg.coordinates[midIdx];
        if (!midCoord) continue;

        const isLast = i + step >= segs.length;
        const el = document.createElement('div');

        if (isLast) {
          el.className = 'fmt-detour-badge';
          el.innerHTML = `<span class="fmt-badge-emoji">↪️</span><span class="fmt-badge-text">ROAD DETOUR</span>`;
          el.title = `↪️ Active traffic detour due to construction of "${project.name}".`;
        } else {
          const emoji = i % 2 === 0 ? '🦺' : '⚠️';
          const label = i % 2 === 0 ? 'ROADWORK' : 'MACHINERY';
          el.className = 'fmt-construction-badge';
          el.innerHTML = `<span class="fmt-badge-emoji">${emoji}</span><span class="fmt-badge-text">${label}</span>`;
          el.title = `⚠️ Active construction: "${project.name}" (${Math.round(project.progress * 100)}%).`;
        }

        el.onclick = (e) => {
          e.stopPropagation();
          onSelectSegmentRef.current(seg.index);
        };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(midCoord as [number, number])
          .addTo(map);
        constructionMarkersRef.current.push(marker);
      }
    }

    return () => {
      constructionMarkersRef.current.forEach((m) => m.remove());
      constructionMarkersRef.current = [];
    };
  }, [activeProjects, network]);

  // Update feature-state when traffic, selection, or draft corridor changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
    updateFeatureStates(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traffic, selectedSegmentIndices, corridorIndices, activeProjects, constructionSegmentSet]);

  return (
    <div
      ref={mapContainer}
      style={{ position: 'absolute', top: '68px', right: 0, bottom: 0, left: 0 }}
      role="region"
      aria-label="Simulated traffic map of Lima"
    />
  );
};
