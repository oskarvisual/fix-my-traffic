/**
 * Metropolitan jurisdiction boundaries and inverted polygon masks for all playable cities:
 * - Buenos Aires, Argentina (Fácil)
 * - Santiago, Chile (Medio)
 * - Lima, Perú (Difícil)
 * - Ciudad de México, México (Muy Difícil)
 *
 * Used to focus player attention on the playable urban simulation zone and shade
 * exterior areas beyond the ministry's jurisdiction.
 */

export interface CityJurisdiction {
  cityId: string;
  name: string;
  cameraBounds: [[number, number], [number, number]];
  minZoom: number;
  perimeterCoords: [number, number][];
  invertedMask: GeoJSON.Feature<GeoJSON.Polygon>;
  perimeterLine: GeoJSON.Feature<GeoJSON.LineString>;
}

function makeInvertedMask(name: string, perimeterCoords: [number, number][]): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    properties: { name: `Fuera de Jurisdicción (${name})` },
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
        perimeterCoords,
      ],
    },
  };
}

function makePerimeterLine(name: string, perimeterCoords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: { name: `Límite Jurisdiccional de ${name}` },
    geometry: {
      type: 'LineString',
      coordinates: perimeterCoords,
    },
  };
}

// 1. Lima, Perú
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

export const LIMA_INVERTED_MASK = makeInvertedMask('Lima Metropolitana', LIMA_PERIMETER_COORDS);
export const LIMA_PERIMETER_LINE = makePerimeterLine('Lima Metropolitana', LIMA_PERIMETER_COORDS);

// 2. Buenos Aires, Argentina
export const BUENOS_AIRES_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-58.530, -34.690], // Southwest: Mataderos / Riachuelo
  [-58.320, -34.520], // Northeast: Río de la Plata / Núñez
];

export const BUENOS_AIRES_PERIMETER_COORDS: [number, number][] = [
  [-58.355, -34.585], // Retiro / Puerto
  [-58.350, -34.615], // Costanera Sur / Reserva Ecológica
  [-58.360, -34.640], // La Boca / Vuelta de Rocha
  [-58.390, -34.655], // Barracas / Riachuelo
  [-58.420, -34.658], // Nueva Pompeya / Puente Alsina
  [-58.455, -34.655], // Villa Soldati / Autopista Dellepiane
  [-58.485, -34.645], // Lugano / Mataderos
  [-58.495, -34.620], // Floresta / Liniers
  [-58.490, -34.590], // Villa Devoto / General Paz
  [-58.475, -34.565], // Saavedra / Coghlan
  [-58.445, -34.545], // Núñez / Monumental
  [-58.395, -34.560], // Palermo Chico / Aeroparque
  [-58.365, -34.575], // Recoleta / Retiro Port
  [-58.355, -34.585], // Close loop
];

// 3. Santiago, Chile
export const SANTIAGO_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-70.760, -33.520], // Southwest: Cerrillos / Maipú Norte
  [-70.540, -33.370], // Northeast: Las Condes / Vitacura
];

export const SANTIAGO_PERIMETER_COORDS: [number, number][] = [
  [-70.640, -33.400], // Huechuraba / Cerro San Cristóbal
  [-70.595, -33.405], // Vitacura / Parque Bicentenario
  [-70.575, -33.420], // Las Condes / El Golf
  [-70.585, -33.445], // Tobalaba / Providencia
  [-70.600, -33.475], // Ñuñoa / Estadio Nacional
  [-70.625, -33.490], // San Joaquín / San Miguel
  [-70.665, -33.492], // Pedro Aguirre Cerda / San Miguel Sur
  [-70.705, -33.480], // Cerrillos / Autopista Central
  [-70.725, -33.455], // Estación Central / Pajaritos
  [-70.720, -33.430], // Quinta Normal / Renca
  [-70.685, -33.405], // Conchalí / Recoleta Norte
  [-70.640, -33.400], // Close loop
];

// 4. Ciudad de México (CDMX)
export const CDMX_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-99.260, 19.330], // Southwest: San Ángel / Mixcoac
  [-99.040, 19.510], // Northeast: Gustavo A. Madero / AICM
];

export const CDMX_PERIMETER_COORDS: [number, number][] = [
  [-99.135, 19.480], // Insurgentes Norte / Lindavista
  [-99.100, 19.460], // Canal del Norte / Consulado
  [-99.075, 19.440], // Venustiano Carranza / Terminal AICM
  [-99.080, 19.410], // Iztacalco / Agrícola Oriental
  [-99.105, 19.385], // Viaducto / Iztapalapa Norte
  [-99.140, 19.365], // Calzada de Tlalpan / Portales
  [-99.175, 19.365], // Del Valle Sur / Eje Central
  [-99.195, 19.385], // San Pedro de los Pinos / Mixcoac
  [-99.215, 19.410], // Tacubaya / Bosque de Chapultepec
  [-99.225, 19.440], // Polanco / Palmas
  [-99.210, 19.470], // Azcapotzalco / Tacuba
  [-99.175, 19.480], // La Raza / Circuito Interior Norte
  [-99.135, 19.480], // Close loop
];

const JURISDICTIONS: Record<string, CityJurisdiction> = {
  lima: {
    cityId: 'lima',
    name: 'Lima Metropolitana',
    cameraBounds: LIMA_CAMERA_BOUNDS,
    minZoom: 11.2,
    perimeterCoords: LIMA_PERIMETER_COORDS,
    invertedMask: LIMA_INVERTED_MASK,
    perimeterLine: LIMA_PERIMETER_LINE,
  },
  buenos_aires: {
    cityId: 'buenos_aires',
    name: 'Ciudad Autónoma de Buenos Aires',
    cameraBounds: BUENOS_AIRES_CAMERA_BOUNDS,
    minZoom: 11.2,
    perimeterCoords: BUENOS_AIRES_PERIMETER_COORDS,
    invertedMask: makeInvertedMask('Buenos Aires', BUENOS_AIRES_PERIMETER_COORDS),
    perimeterLine: makePerimeterLine('Buenos Aires', BUENOS_AIRES_PERIMETER_COORDS),
  },
  santiago: {
    cityId: 'santiago',
    name: 'Santiago de Chile (Gran Santiago)',
    cameraBounds: SANTIAGO_CAMERA_BOUNDS,
    minZoom: 11.2,
    perimeterCoords: SANTIAGO_PERIMETER_COORDS,
    invertedMask: makeInvertedMask('Gran Santiago', SANTIAGO_PERIMETER_COORDS),
    perimeterLine: makePerimeterLine('Gran Santiago', SANTIAGO_PERIMETER_COORDS),
  },
  cdmx: {
    cityId: 'cdmx',
    name: 'Ciudad de México (Valle de México)',
    cameraBounds: CDMX_CAMERA_BOUNDS,
    minZoom: 11.0,
    perimeterCoords: CDMX_PERIMETER_COORDS,
    invertedMask: makeInvertedMask('Ciudad de México', CDMX_PERIMETER_COORDS),
    perimeterLine: makePerimeterLine('Ciudad de México', CDMX_PERIMETER_COORDS),
  },
};

export function getCityJurisdiction(cityId: string): CityJurisdiction {
  return JURISDICTIONS[cityId] || JURISDICTIONS.lima;
}
