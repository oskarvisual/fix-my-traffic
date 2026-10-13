import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { type MapGeoJSONFeature, type MapLayerMouseEvent } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RoadSegment } from '../domain/types';
import { congestionColor } from '../ui/format';

// Explicit worker URL keeps MapLibre functional in Vite's module-based dev server.
maplibregl.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());

interface TrafficMapProps { roads: RoadSegment[]; selectedRoadId?: string; onRoadSelect: (id: string) => void; }

export function TrafficMap({ roads, selectedRoadId, onRoadSelect }: TrafficMapProps) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | undefined>(undefined);
  const initialRoads = useRef(roads);
  const initialSelectedRoadId = useRef(selectedRoadId);
  const onRoadSelectRef = useRef(onRoadSelect);
  useEffect(() => { onRoadSelectRef.current = onRoadSelect; }, [onRoadSelect]);
  useEffect(() => {
    if (!element.current || map.current) return;
    const instance = new maplibregl.Map({ container: element.current, center: [-77.024, -12.091], zoom: 12.3, style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.72, 'raster-saturation': -0.7, 'raster-brightness-max': 0.66 } }] } });
    instance.on('load', () => {
      instance.addSource('roads', { type: 'geojson', data: roadsGeoJson(initialRoads.current) });
      instance.addLayer({ id: 'traffic-glow', type: 'line', source: 'roads', paint: { 'line-color': ['get', 'color'], 'line-width': 12, 'line-opacity': 0.25, 'line-blur': 3 } });
      instance.addLayer({ id: 'traffic', type: 'line', source: 'roads', paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['==', ['get', 'id'], initialSelectedRoadId.current ?? ''], 7, 5], 'line-opacity': 0.96 } });
      instance.on('click', 'traffic', (event: MapLayerMouseEvent) => { const feature = event.features?.[0] as MapGeoJSONFeature | undefined; const id = feature?.properties?.id; if (typeof id === 'string') onRoadSelectRef.current(id); });
      instance.on('mouseenter', 'traffic', () => { instance.getCanvas().style.cursor = 'pointer'; });
      instance.on('mouseleave', 'traffic', () => { instance.getCanvas().style.cursor = ''; });
    });
    map.current = instance;
    return () => { instance.remove(); map.current = undefined; };
  }, [onRoadSelect]);
  useEffect(() => { const source = map.current?.getSource('roads') as maplibregl.GeoJSONSource | undefined; source?.setData(roadsGeoJson(roads)); }, [roads]);
  useEffect(() => { const instance = map.current; if (instance?.getLayer('traffic')) instance.setPaintProperty('traffic', 'line-width', ['case', ['==', ['get', 'id'], selectedRoadId ?? ''], 7, 5]); }, [selectedRoadId]);
  return <div ref={element} className="map" aria-label="Simulated traffic map of Lima" />;
}

function roadsGeoJson(roads: RoadSegment[]): FeatureCollection<LineString> {
  return { type: 'FeatureCollection', features: roads.map((road) => ({ type: 'Feature', properties: { id: road.id, color: congestionColor(road.congestion) }, geometry: { type: 'LineString', coordinates: road.coordinates } })) };
}
