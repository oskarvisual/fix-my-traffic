# Data sources and attribution

The basemap uses OpenStreetMap raster tiles and displays the required OpenStreetMap contributor attribution in MapLibre.

The MVP corridor geometries, capacities, demand and congestion are hand-authored game fixtures. They are **simulated game data**, not live traffic, government statistics, or a complete road network. The UI labels the map as a simulation.

No Google Maps traffic is fetched or scraped. A future city importer should retain source URL, license, generated date, road-network version and dataset version in shared Supabase city tables.
