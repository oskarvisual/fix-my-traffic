# Architecture

`data → simulation → game state → presentation` is a one-way boundary. `src/data` contains a small Lima road-network fixture; `src/simulation` is pure domain logic; `src/storage` persists a complete local game in IndexedDB; React and MapLibre only render and dispatch player choices.

## Decisions

- MapLibre GL JS renders OSM raster basemap tiles with a local GeoJSON traffic overlay.
- The initial network is intentionally a simplified, simulated subset rather than an asserted municipal dataset.
- `TrafficDataProvider` is deferred until imported city datasets exist; the fixture serves the MVP's mock provider role without external requests beyond map tiles.
- Supabase is represented by environment variables and a documented shared-data boundary. No credentials are required for local play.
- Congestion is derived from demand/capacity. Lane loss redistributes a configurable share to adjacent graph nodes.

## Persistence

`gameStore` saves the complete state under a versioned IndexedDB key after each action. Simulation only advances on explicit player actions.
