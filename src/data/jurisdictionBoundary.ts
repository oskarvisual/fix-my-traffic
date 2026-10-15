/**
 * Metropolitan jurisdiction boundaries and inverted polygon mask for Lima, Peru.
 * Used to focus player attention on the playable urban simulation zone and shade
 * exterior areas beyond the ministry's jurisdiction.
 */

export const LIMA_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-77.18, -12.22], // Southwest: Callao / Chorrillos Pacific ocean
  [-76.88, -11.96], // Northeast: Ate / Rímac / SJL foothills
];

export const LIMA_PERIMETER_COORDS: [number, number][] = [
  [-77.125, -12.030], // Callao Norte / Aeropuerto
  [-77.120, -12.070], // La Perla / Costa Verde Callao
  [-77.095, -12.115], // San Miguel / Magdalena Costa
  [-77.060, -12.148], // Miraflores / Barranco Malecón
  [-77.025, -12.168], // Chorrillos / Morro Solar
  [-76.970, -12.160], // Surco Sur / San Juan de Miraflores
  [-76.955, -12.120], // Santiago de Surco / Panamericana Sur
  [-76.945, -12.078], // La Molina / Javier Prado Este
  [-76.950, -12.040], // Santa Anita / Vía de Evitamiento Este
  [-76.975, -12.012], // El Agustino / SJL Sur
  [-77.020, -12.008], // Rímac / Cerro San Cristóbal
  [-77.080, -12.015], // San Martín de Porres Sur
  [-77.125, -12.030], // Return to Callao Norte
];

/** Inverted polygon mask: fills entire world except Lima Metropolitana */
export const LIMA_INVERTED_MASK: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: 'Feature',
  properties: {
    name: 'Fuera de Jurisdicción',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      // Outer ring covering the world
      [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ],
      // Inner hole cutout (Lima Metropolitana)
      LIMA_PERIMETER_COORDS,
    ],
  },
};

/** Boundary perimeter line for neon/dashed border */
export const LIMA_PERIMETER_LINE: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: {
    name: 'Límite Jurisdiccional de Lima Metropolitana',
  },
  geometry: {
    type: 'LineString',
    coordinates: LIMA_PERIMETER_COORDS,
  },
};
