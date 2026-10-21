import type { Project } from '../simulation/state';
import type { RoadNetwork } from '../simulation/traffic/network';

function findSegmentIds(network: RoadNetwork, names: string[], limit = 8): string[] {
  const ids: string[] = [];
  for (const s of network.segments) {
    const sName = s.name.toLowerCase();
    if (names.some((n) => sName.includes(n.toLowerCase()))) {
      ids.push(s.id);
      if (ids.length >= limit) break;
    }
  }
  return ids;
}

export function getInitialCityProjects(cityId: string, network: RoadNetwork): Project[] {
  if (cityId === 'buenos_aires') {
    const mb9j = findSegmentIds(network, ['9 de julio', 'lima', 'bernardo de irigoyen'], 6);
    return [
      {
        id: 'ba-proj-subte-d',
        typeId: 'subway',
        name: 'Modernización Señalamiento Subte Línea D',
        segmentIds: [],
        streetKm: 6.8,
        cost: 180_000_000,
        approvedDay: -120,
        phase: 'construction',
        phaseStartDay: -90,
        planningDays: 30,
        constructionDays: 280,
        progress: 0.70,
        completedDay: null,
        contractor: {
          id: 'c-roggio',
          name: 'Benito Roggio Transporte S.A.',
          bribeReceived: 0,
          corruptionRisk: 0.15,
          delayRisk: 0.20,
        },
        subwayStations: [
          { name: 'Catedral', coordinates: [-58.374, -34.608] },
          { name: 'Tribunales', coordinates: [-58.388, -34.595] },
          { name: 'Pueyrredón', coordinates: [-58.412, -34.584] },
          { name: 'Palermo', coordinates: [-58.423, -34.579] },
        ],
        subwayAlignment: [
          [-58.374, -34.608],
          [-58.388, -34.595],
          [-58.412, -34.584],
          [-58.423, -34.579],
        ],
      },
      {
        id: 'ba-proj-mb9j',
        typeId: 'brt',
        name: 'Metrobús 9 de Julio — Enlace Constitución',
        segmentIds: mb9j,
        streetKm: 3.2,
        cost: 95_000_000,
        approvedDay: -75,
        phase: 'construction',
        phaseStartDay: -50,
        planningDays: 25,
        constructionDays: 160,
        progress: 0.45,
        completedDay: null,
        contractor: {
          id: 'c-dycasa',
          name: 'Dycasa Construcciones',
          bribeReceived: 0,
          corruptionRisk: 0.10,
          delayRisk: 0.15,
        },
      },
    ];
  }

  if (cityId === 'santiago') {
    const alameda = findSegmentIds(network, ["o'higgins", 'alameda', 'providencia'], 6);
    return [
      {
        id: 'scl-proj-metro7',
        typeId: 'subway',
        name: 'Construcción Línea 7 del Metro (Renca — Vitacura)',
        segmentIds: [],
        streetKm: 14.5,
        cost: 2_528_000_000,
        approvedDay: -240,
        phase: 'construction',
        phaseStartDay: -180,
        planningDays: 60,
        constructionDays: 720,
        progress: 0.35,
        completedDay: null,
        contractor: {
          id: 'c-metro-scl',
          name: 'Metro S.A. Concesiones',
          bribeReceived: 0,
          corruptionRisk: 0.10,
          delayRisk: 0.25,
        },
        subwayStations: [
          { name: 'Brasil / Renca', coordinates: [-70.720, -33.415] },
          { name: 'Cumming', coordinates: [-70.670, -33.435] },
          { name: 'Baquedano L7', coordinates: [-70.635, -33.437] },
          { name: 'Isidora Goyenechea', coordinates: [-70.598, -33.415] },
        ],
        subwayAlignment: [
          [-70.720, -33.415],
          [-70.670, -33.435],
          [-70.635, -33.437],
          [-70.598, -33.415],
        ],
      },
      {
        id: 'scl-proj-red-alameda',
        typeId: 'brt',
        name: 'Electrocorredor Alameda — Providencia (Red)',
        segmentIds: alameda,
        streetKm: 4.8,
        cost: 140_000_000,
        approvedDay: -90,
        phase: 'construction',
        phaseStartDay: -60,
        planningDays: 30,
        constructionDays: 190,
        progress: 0.60,
        completedDay: null,
        contractor: {
          id: 'c-metbus',
          name: 'Consorcio Metbus Chile',
          bribeReceived: 0,
          corruptionRisk: 0.08,
          delayRisk: 0.15,
        },
      },
    ];
  }

  if (cityId === 'cdmx') {
    return [
      {
        id: 'cdmx-proj-metro-l1',
        typeId: 'subway',
        name: 'Nueva Línea 1 Metro (Salto del Agua — Observatorio)',
        segmentIds: [],
        streetKm: 9.8,
        cost: 1_850_000_000,
        approvedDay: -180,
        phase: 'construction',
        phaseStartDay: -140,
        planningDays: 40,
        constructionDays: 360,
        progress: 0.55,
        completedDay: null,
        contractor: {
          id: 'c-crrc',
          name: 'CRRC Zhuzhou Locomotive',
          bribeReceived: 0,
          corruptionRisk: 0.25,
          delayRisk: 0.40,
        },
        subwayStations: [
          { name: 'Salto del Agua', coordinates: [-99.142, 19.426] },
          { name: 'Cuauhtémoc', coordinates: [-99.155, 19.426] },
          { name: 'Insurgentes L1', coordinates: [-99.163, 19.423] },
          { name: 'Chapultepec', coordinates: [-99.176, 19.421] },
          { name: 'Tacubaya L1', coordinates: [-99.187, 19.403] },
        ],
        subwayAlignment: [
          [-99.142, 19.426],
          [-99.155, 19.426],
          [-99.163, 19.423],
          [-99.176, 19.421],
          [-99.187, 19.403],
        ],
      },
      {
        id: 'cdmx-proj-metro-l12',
        typeId: 'subway',
        name: 'Ampliación Poniente Metro Línea 12 (Mixcoac — Observatorio)',
        segmentIds: [],
        streetKm: 4.6,
        cost: 520_000_000,
        approvedDay: -150,
        phase: 'construction',
        phaseStartDay: -110,
        planningDays: 40,
        constructionDays: 320,
        progress: 0.45,
        completedDay: null,
        contractor: {
          id: 'c-carso',
          name: 'Carso Infraestructura y Construcción',
          bribeReceived: 0,
          corruptionRisk: 0.20,
          delayRisk: 0.30,
        },
        subwayStations: [
          { name: 'Mixcoac L12', coordinates: [-99.187, 19.375] },
          { name: 'Valentín Campa', coordinates: [-99.195, 19.388] },
          { name: 'Observatorio L12', coordinates: [-99.200, 19.398] },
        ],
        subwayAlignment: [
          [-99.187, 19.375],
          [-99.195, 19.388],
          [-99.200, 19.398],
        ],
      },
    ];
  }

  if (cityId === 'lima') {
    const ateSegments = findSegmentIds(network, ['nicolas ayllon', 'carretera central', '28 de julio', 'grau'], 6);
    return [
      {
        id: 'lima-proj-metro-l2',
        typeId: 'subway',
        name: 'Línea 2 del Metro de Lima (Subterráneo Ate — Callao)',
        segmentIds: ateSegments,
        streetKm: 12.4,
        cost: 5_346_000_000,
        approvedDay: -365,
        phase: 'construction',
        phaseStartDay: -300,
        planningDays: 65,
        constructionDays: 900,
        progress: 0.65,
        completedDay: null,
        contractor: {
          id: 'c-metro-lima-2',
          name: 'Consorcio Metro de Lima Línea 2',
          bribeReceived: 0,
          corruptionRisk: 0.25,
          delayRisk: 0.35,
        },
        subwayStations: [
          { name: 'Municipalidad de Ate', coordinates: [-76.940, -12.042] },
          { name: 'Mercado Santa Anita', coordinates: [-76.972, -12.052] },
          { name: 'Evitamiento L2', coordinates: [-77.000, -12.061] },
          { name: 'Plaza Bolognesi', coordinates: [-77.042, -12.062] },
        ],
        subwayAlignment: [
          [-76.940, -12.042],
          [-76.972, -12.052],
          [-77.000, -12.061],
          [-77.025, -12.064],
          [-77.042, -12.062],
        ],
      },
      {
        id: 'lima-proj-metro-norte',
        typeId: 'brt',
        name: 'Ampliación Metropolitano Norte (Chimpu Ocllo)',
        segmentIds: findSegmentIds(network, ['tupac amaru', 'universitaria'], 4),
        streetKm: 4.2,
        cost: 110_000_000,
        approvedDay: -120,
        phase: 'construction',
        phaseStartDay: -90,
        planningDays: 30,
        constructionDays: 210,
        progress: 0.85,
        completedDay: null,
        contractor: {
          id: 'c-aenza',
          name: 'Aenza (ex Graña y Montero)',
          bribeReceived: 0,
          corruptionRisk: 0.20,
          delayRisk: 0.15,
        },
      },
    ];
  }

  if (cityId === 'madrid') {
    return [
      {
        id: 'mad-proj-metro-l11',
        typeId: 'subway',
        name: 'Metro de Madrid Línea 11 (Plaza Elíptica — Conde de Casal)',
        segmentIds: [],
        streetKm: 6.3,
        cost: 210_000_000,
        approvedDay: -150,
        phase: 'construction',
        phaseStartDay: -110,
        planningDays: 40,
        constructionDays: 320,
        progress: 0.55,
        completedDay: null,
        contractor: {
          id: 'c-acs',
          name: 'ACS Dragados',
          bribeReceived: 0,
          corruptionRisk: 0.12,
          delayRisk: 0.18,
        },
        subwayStations: [
          { name: 'Plaza Elíptica', coordinates: [-3.719, 40.385] },
          { name: 'Comillas', coordinates: [-3.712, 40.392] },
          { name: 'Madrid Río', coordinates: [-3.705, 40.398] },
          { name: 'Palos de la Frontera', coordinates: [-3.694, 40.403] },
          { name: 'Atocha', coordinates: [-3.691, 40.407] },
          { name: 'Conde de Casal', coordinates: [-3.670, 40.405] },
        ],
        subwayAlignment: [
          [-3.719, 40.385],
          [-3.712, 40.392],
          [-3.705, 40.398],
          [-3.694, 40.403],
          [-3.691, 40.407],
          [-3.670, 40.405],
        ],
      },
      {
        id: 'mad-proj-castellana-bus',
        typeId: 'brt',
        name: 'Plataforma Reservada Bus-VAO Castellana',
        segmentIds: findSegmentIds(network, ['castellana', 'recoletos', 'prado'], 6),
        streetKm: 4.8,
        cost: 85_000_000,
        approvedDay: -90,
        phase: 'construction',
        phaseStartDay: -60,
        planningDays: 30,
        constructionDays: 180,
        progress: 0.70,
        completedDay: null,
        contractor: {
          id: 'c-fcc',
          name: 'FCC Construcción',
          bribeReceived: 0,
          corruptionRisk: 0.10,
          delayRisk: 0.12,
        },
      },
    ];
  }

  if (cityId === 'new_york') {
    return [
      {
        id: 'ny-proj-sas-ph2',
        typeId: 'subway',
        name: 'Second Avenue Subway Phase 2 (96th St to 125th St)',
        segmentIds: [],
        streetKm: 2.5,
        cost: 450_000_000,
        approvedDay: -200,
        phase: 'construction',
        phaseStartDay: -150,
        planningDays: 50,
        constructionDays: 450,
        progress: 0.45,
        completedDay: null,
        contractor: {
          id: 'c-skanska',
          name: 'Skanska USA Civil',
          bribeReceived: 0,
          corruptionRisk: 0.08,
          delayRisk: 0.25,
        },
        subwayStations: [
          { name: '96th St', coordinates: [-73.951, 40.784] },
          { name: '106th St', coordinates: [-73.945, 40.791] },
          { name: '116th St', coordinates: [-73.939, 40.798] },
          { name: '125th St / Harlem', coordinates: [-73.933, 40.804] },
        ],
        subwayAlignment: [
          [-73.951, 40.784],
          [-73.945, 40.791],
          [-73.939, 40.798],
          [-73.933, 40.804],
        ],
      },
      {
        id: 'ny-proj-m15-sbs',
        typeId: 'brt',
        name: 'First & Second Avenues Dedicated Busway Extension',
        segmentIds: findSegmentIds(network, ['1st ave', 'first avenue', '2nd ave', 'second avenue'], 6),
        streetKm: 5.2,
        cost: 95_000_000,
        approvedDay: -80,
        phase: 'construction',
        phaseStartDay: -50,
        planningDays: 30,
        constructionDays: 160,
        progress: 0.65,
        completedDay: null,
        contractor: {
          id: 'c-tutor-perini',
          name: 'Tutor Perini Corporation',
          bribeReceived: 0,
          corruptionRisk: 0.15,
          delayRisk: 0.20,
        },
      },
    ];
  }

  return [];
}
