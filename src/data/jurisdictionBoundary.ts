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
  [-77.28, -12.35], // Southwest: Isla San Lorenzo / Litoral Chorrillos - Villa
  [-76.75, -11.82], // Northeast: Carabayllo / Chosica / SJL Norte
];

export const LIMA_PERIMETER_COORDS: [number, number][] = [
  [-77.160, -11.950], // Ventanilla / Gambetta Norte
  [-77.155, -12.020], // Aeropuerto Jorge Chávez / Faucett
  [-77.165, -12.065], // La Punta / Callao Puerto
  [-77.130, -12.100], // Costa Verde Callao / San Miguel
  [-77.075, -12.145], // Magdalena / Miraflores Costa
  [-77.035, -12.185], // Chorrillos / Villa Pantanos
  [-76.940, -12.240], // Villa El Salvador / Panamericana Sur
  [-76.900, -12.180], // VMT / San Juan de Miraflores
  [-76.880, -12.120], // La Molina / Manchay
  [-76.870, -12.030], // Ate / Carretera Central / Santa Anita
  [-76.940, -11.920], // San Juan de Lurigancho Norte
  [-77.020, -11.860], // Comas / Carabayllo
  [-77.090, -11.880], // Puente Piedra / Panamericana Norte
  [-77.140, -11.910], // Los Olivos / San Martín de Porres Norte
  [-77.160, -11.950], // Close loop
];

export const LIMA_INVERTED_MASK = makeInvertedMask('Lima Metropolitana', LIMA_PERIMETER_COORDS);
export const LIMA_PERIMETER_LINE = makePerimeterLine('Lima Metropolitana', LIMA_PERIMETER_COORDS);

// 2. Buenos Aires, Argentina
export const BUENOS_AIRES_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-58.650, -34.780], // Southwest: Ezeiza / La Matanza
  [-58.240, -34.430], // Northeast: Río de la Plata / San Isidro / Tigre
];

export const BUENOS_AIRES_PERIMETER_COORDS: [number, number][] = [
  [-58.330, -34.560], // Río de la Plata / Aeroparque
  [-58.320, -34.620], // Costanera Sur / Puerto Madero
  [-58.340, -34.665], // Avellaneda / Dock Sud
  [-58.380, -34.700], // Lanús / Riachuelo Sur
  [-58.450, -34.710], // Lomas de Zamora Norte
  [-58.520, -34.690], // La Matanza / Autopista Riccheri
  [-58.550, -34.640], // Ciudadela / Liniers Oeste
  [-58.540, -34.580], // San Martín / Tres de Febrero
  [-58.500, -34.520], // Vicente López / General Paz Norte
  [-58.460, -34.500], // Olivos / Río de la Plata
  [-58.380, -34.530], // Belgrano / Núñez Costa
  [-58.330, -34.560], // Close loop
];

// 3. Santiago, Chile
export const SANTIAGO_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-70.880, -33.620], // Southwest: Maipú Sur / San Bernardo
  [-70.440, -33.280], // Northeast: Lo Barnechea / Chicureo
];

export const SANTIAGO_PERIMETER_COORDS: [number, number][] = [
  [-70.620, -33.350], // Huechuraba / Chicureo
  [-70.520, -33.360], // Lo Barnechea Norte
  [-70.490, -33.400], // Las Condes Alto
  [-70.530, -33.460], // La Reina / Peñalolén
  [-70.560, -33.530], // La Florida / Puente Alto Norte
  [-70.630, -33.580], // San Bernardo / Autopista Central
  [-70.720, -33.570], // San Ramón / La Cisterna Sur
  [-70.790, -33.530], // Maipú / Pajaritos Sur
  [-70.800, -33.440], // Pudahuel / Aeropuerto SCL
  [-70.760, -33.380], // Renca / Cerro Colorado
  [-70.690, -33.350], // Conchalí / Quilicura
  [-70.620, -33.350], // Close loop
];

// 4. Ciudad de México (CDMX)
export const CDMX_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-99.380, 19.220], // Southwest: Magdalena Contreras / Cuajimalpa
  [-98.920, 19.620], // Northeast: Ecatepec / Texcoco
];

export const CDMX_PERIMETER_COORDS: [number, number][] = [
  [-99.120, 19.570], // Tlalnepantla / Gustavo A. Madero Norte
  [-99.040, 19.530], // Ecatepec / Indios Verdes
  [-99.000, 19.460], // Texcoco / AICM Oriente
  [-98.980, 19.380], // Nezahualcóyotl / Iztapalapa Oriente
  [-99.040, 19.300], // Xochimilco / Periférico Sur
  [-99.140, 19.260], // Tlalpan Sur
  [-99.230, 19.300], // San Ángel / Pedregal / Periférico Poniente
  [-99.300, 19.360], // Santa Fe / Bosques de las Lomas
  [-99.280, 19.450], // Naucalpan / Toreo de Cuatro Caminos
  [-99.220, 19.530], // Azcapotzalco / Satélite
  [-99.120, 19.570], // Close loop
];

// 5. Madrid, España
export const MADRID_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-3.82, 40.34],
  [-3.58, 40.50],
];

export const MADRID_PERIMETER_COORDS: [number, number][] = [
  [-3.765, 40.475],
  [-3.700, 40.480],
  [-3.635, 40.475],
  [-3.630, 40.420],
  [-3.635, 40.365],
  [-3.700, 40.360],
  [-3.765, 40.365],
  [-3.770, 40.420],
  [-3.765, 40.475],
];

// 6. New York, United States
export const NEW_YORK_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-74.06, 40.68],
  [-73.90, 40.83],
];

export const NEW_YORK_PERIMETER_COORDS: [number, number][] = [
  [-74.025, 40.810],
  [-73.970, 40.815],
  [-73.930, 40.810],
  [-73.925, 40.750],
  [-73.930, 40.695],
  [-73.970, 40.690],
  [-74.025, 40.695],
  [-74.030, 40.750],
  [-74.025, 40.810],
];

const JURISDICTIONS: Record<string, CityJurisdiction> = {
  lima: {
    cityId: 'lima',
    name: 'Lima Metropolitana',
    cameraBounds: LIMA_CAMERA_BOUNDS,
    minZoom: 9.8,
    perimeterCoords: LIMA_PERIMETER_COORDS,
    invertedMask: LIMA_INVERTED_MASK,
    perimeterLine: LIMA_PERIMETER_LINE,
  },
  buenos_aires: {
    cityId: 'buenos_aires',
    name: 'Ciudad Autónoma de Buenos Aires',
    cameraBounds: BUENOS_AIRES_CAMERA_BOUNDS,
    minZoom: 9.8,
    perimeterCoords: BUENOS_AIRES_PERIMETER_COORDS,
    invertedMask: makeInvertedMask('Buenos Aires', BUENOS_AIRES_PERIMETER_COORDS),
    perimeterLine: makePerimeterLine('Buenos Aires', BUENOS_AIRES_PERIMETER_COORDS),
  },
  santiago: {
    cityId: 'santiago',
    name: 'Santiago de Chile (Gran Santiago)',
    cameraBounds: SANTIAGO_CAMERA_BOUNDS,
    minZoom: 9.8,
    perimeterCoords: SANTIAGO_PERIMETER_COORDS,
    invertedMask: makeInvertedMask('Gran Santiago', SANTIAGO_PERIMETER_COORDS),
    perimeterLine: makePerimeterLine('Gran Santiago', SANTIAGO_PERIMETER_COORDS),
  },
  cdmx: {
    cityId: 'cdmx',
    name: 'Ciudad de México (Valle de México)',
    cameraBounds: CDMX_CAMERA_BOUNDS,
    minZoom: 9.8,
    perimeterCoords: CDMX_PERIMETER_COORDS,
    invertedMask: makeInvertedMask('Ciudad de México', CDMX_PERIMETER_COORDS),
    perimeterLine: makePerimeterLine('Ciudad de México', CDMX_PERIMETER_COORDS),
  },
  madrid: {
    cityId: 'madrid',
    name: 'Comunidad de Madrid',
    cameraBounds: MADRID_CAMERA_BOUNDS,
    minZoom: 9.8,
    perimeterCoords: MADRID_PERIMETER_COORDS,
    invertedMask: makeInvertedMask('Madrid', MADRID_PERIMETER_COORDS),
    perimeterLine: makePerimeterLine('Madrid', MADRID_PERIMETER_COORDS),
  },
  new_york: {
    cityId: 'new_york',
    name: 'New York City (NYC)',
    cameraBounds: NEW_YORK_CAMERA_BOUNDS,
    minZoom: 9.8,
    perimeterCoords: NEW_YORK_PERIMETER_COORDS,
    invertedMask: makeInvertedMask('New York', NEW_YORK_PERIMETER_COORDS),
    perimeterLine: makePerimeterLine('New York', NEW_YORK_PERIMETER_COORDS),
  },
};

// Load custom jurisdictions from localStorage if available
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = localStorage.getItem('fmt_custom_jurisdictions');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, CityJurisdiction>;
      Object.assign(JURISDICTIONS, parsed);
    }
  } catch {
    // Ignore storage errors
  }
}

export function registerCustomJurisdiction(jur: CityJurisdiction): void {
  JURISDICTIONS[jur.cityId] = jur;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = JSON.parse(localStorage.getItem('fmt_custom_jurisdictions') || '{}');
      saved[jur.cityId] = jur;
      localStorage.setItem('fmt_custom_jurisdictions', JSON.stringify(saved));
    } catch {
      // Ignore storage errors
    }
  }
}

export function getCityJurisdiction(cityId: string): CityJurisdiction {
  return JURISDICTIONS[cityId] || JURISDICTIONS.lima;
}

