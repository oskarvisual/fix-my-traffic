import fs from 'node:fs';
import path from 'node:path';

// Haversine distance in meters
function haversineM(p1, p2) {
  const R = 6371000;
  const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLon = ((p2[0] - p1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1[1] * Math.PI) / 180) *
      Math.cos((p2[1] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function wayLengthM(coords) {
  let len = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    len += haversineM(coords[i], coords[i + 1]);
  }
  return Math.round(len);
}

const v2Path = path.join(process.cwd(), 'public/data/cities/lima/v2/roads.json');
const dataset = JSON.parse(fs.readFileSync(v2Path, 'utf8'));

console.log(`Initial Lima dataset: ${dataset.segments.length} segments, ${dataset.nodes.length} nodes, ${dataset.names.length} names.`);

const names = [...dataset.names];
const nodes = [...dataset.nodes];
const segments = [...dataset.segments];

function getNameIndex(name) {
  let idx = names.indexOf(name);
  if (idx === -1) {
    idx = names.length;
    names.push(name);
  }
  return idx;
}

function getNodeIndex(coord) {
  const [lng, lat] = coord;
  // Look for nearby existing node within 30 meters
  for (let i = 0; i < nodes.length; i++) {
    const d = haversineM(nodes[i], coord);
    if (d < 35) return i;
  }
  const idx = nodes.length;
  nodes.push([Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]);
  return idx;
}

// Major outer corridors with realistic GPS waypoints
const NEW_CORRIDORS = [
  // 1. Panamericana Norte (San Martín de Porres -> Los Olivos -> Comas)
  {
    name: 'Autopista Panamericana Norte',
    type: 0, // motorway
    lanes: 4,
    speed: 80,
    coords: [
      [-77.043, -12.040],
      [-77.049, -12.025],
      [-77.055, -12.008],
      [-77.060, -11.990],
      [-77.063, -11.970],
      [-77.066, -11.950],
    ],
  },
  // 2. Avenida Túpac Amaru (Rímac -> Independencia -> Comas)
  {
    name: 'Avenida Túpac Amaru',
    type: 1, // trunk
    lanes: 3,
    speed: 60,
    coords: [
      [-77.032, -12.030],
      [-77.042, -12.010],
      [-77.050, -11.990],
      [-77.055, -11.965],
      [-77.058, -11.940],
    ],
  },
  // 3. Avenida Carlos Izaguirre (Los Olivos este a oeste)
  {
    name: 'Avenida Carlos Izaguirre',
    type: 2, // primary
    lanes: 3,
    speed: 50,
    coords: [
      [-77.085, -11.992],
      [-77.060, -11.990],
      [-77.045, -11.990],
      [-77.035, -11.990],
    ],
  },
  // 4. Avenida Tomás Valle (Aeropuerto -> Panamericana Norte)
  {
    name: 'Avenida Tomás Valle',
    type: 2, // primary
    lanes: 3,
    speed: 50,
    coords: [
      [-77.115, -12.015],
      [-77.085, -12.010],
      [-77.060, -12.005],
      [-77.048, -12.002],
    ],
  },
  // 5. Avenida Elmer Faucett (Aeropuerto -> Av. La Marina / San Miguel)
  {
    name: 'Avenida Elmer Faucett',
    type: 1, // trunk
    lanes: 3,
    speed: 60,
    coords: [
      [-77.115, -11.995],
      [-77.114, -12.020],
      [-77.110, -12.045],
      [-77.098, -12.062],
      [-77.085, -12.078],
    ],
  },
  // 6. Avenida Óscar R. Benavides (Colonial - Lima Centro a Callao Puerto)
  {
    name: 'Avenida Óscar R. Benavides',
    type: 2, // primary
    lanes: 3,
    speed: 50,
    coords: [
      [-77.044, -12.046],
      [-77.070, -12.052],
      [-77.095, -12.056],
      [-77.120, -12.059],
      [-77.145, -12.061],
    ],
  },
  // 7. Avenida República de Argentina (Lima Centro a Callao Industrial)
  {
    name: 'Avenida República de Argentina',
    type: 2, // primary
    lanes: 3,
    speed: 50,
    coords: [
      [-77.045, -12.042],
      [-77.070, -12.045],
      [-77.100, -12.048],
      [-77.130, -12.052],
      [-77.155, -12.055],
    ],
  },
  // 8. Avenida Guardia Chalaca / Sáenz Peña (Callao Centro a Puerto)
  {
    name: 'Avenida Guardia Chalaca',
    type: 2, // primary
    lanes: 3,
    speed: 50,
    coords: [
      [-77.110, -12.065],
      [-77.135, -12.062],
      [-77.155, -12.058],
      [-77.165, -12.062],
    ],
  },
  // 9. Autopista Panamericana Sur (Vía Expresa Sur -> Chorrillos -> Peaje Villa)
  {
    name: 'Autopista Panamericana Sur',
    type: 0, // motorway
    lanes: 4,
    speed: 80,
    coords: [
      [-76.995, -12.138],
      [-76.985, -12.155],
      [-76.972, -12.175],
      [-76.960, -12.195],
      [-76.945, -12.225],
    ],
  },
  // 10. Avenida Defensores del Morro (Huaylas - Chorrillos)
  {
    name: 'Avenida Defensores del Morro',
    type: 2, // primary
    lanes: 3,
    speed: 50,
    coords: [
      [-77.025, -12.168],
      [-77.022, -12.178],
      [-77.018, -12.195],
      [-77.008, -12.215],
    ],
  },
  // 11. Avenida Los Próceres de Surco
  {
    name: 'Avenida Los Próceres de Surco',
    type: 2, // primary
    lanes: 3,
    speed: 50,
    coords: [
      [-77.000, -12.130],
      [-76.995, -12.148],
      [-76.988, -12.165],
      [-76.978, -12.180],
    ],
  },
  // 12. Avenida Próceres de la Independencia (San Juan de Lurigancho)
  {
    name: 'Avenida Próceres de la Independencia',
    type: 1, // trunk
    lanes: 3,
    speed: 60,
    coords: [
      [-77.005, -12.035],
      [-76.995, -12.015],
      [-76.985, -11.995],
      [-76.975, -11.970],
      [-76.965, -11.945],
    ],
  },
  // 13. Avenida Fernando Wiesse (SJL Norte)
  {
    name: 'Avenida Fernando Wiesse',
    type: 2, // primary
    lanes: 3,
    speed: 50,
    coords: [
      [-76.965, -11.945],
      [-76.955, -11.925],
      [-76.945, -11.905],
    ],
  },
  // 14. Prolongación Avenida Javier Prado Este (La Molina -> Manchay)
  {
    name: 'Avenida Javier Prado Este',
    type: 1, // trunk
    lanes: 3,
    speed: 60,
    coords: [
      [-76.970, -12.080],
      [-76.950, -12.075],
      [-76.935, -12.072],
      [-76.920, -12.078],
      [-76.905, -12.085],
    ],
  },
  // 15. Avenida Nicolás Ayllón (Carretera Central - Santa Anita -> Ate Vitarte)
  {
    name: 'Carretera Central',
    type: 1, // trunk
    lanes: 3,
    speed: 60,
    coords: [
      [-76.995, -12.060],
      [-76.970, -12.050],
      [-76.945, -12.042],
      [-76.920, -12.035],
      [-76.895, -12.025],
    ],
  },
  // 16. Autopista Ramiro Prialé (Evitamiento Este -> Huachipa)
  {
    name: 'Autopista Ramiro Prialé',
    type: 0, // motorway
    lanes: 3,
    speed: 80,
    coords: [
      [-77.000, -12.038],
      [-76.975, -12.030],
      [-76.945, -12.022],
      [-76.915, -12.015],
    ],
  },
  // 17. Avenida La Molina
  {
    name: 'Avenida La Molina',
    type: 2, // primary
    lanes: 3,
    speed: 50,
    coords: [
      [-76.945, -12.055],
      [-76.935, -12.072],
      [-76.930, -12.095],
      [-76.920, -12.125],
    ],
  },
  // 18. Circuito de Playas Costa Verde Norte (San Miguel a La Punta Callao)
  {
    name: 'Circuito de Playas',
    type: 0, // motorway
    lanes: 3,
    speed: 70,
    coords: [
      [-77.095, -12.115],
      [-77.115, -12.095],
      [-77.135, -12.080],
      [-77.155, -12.070],
      [-77.165, -12.065],
    ],
  },
];

let addedCount = 0;

for (const c of NEW_CORRIDORS) {
  const nameIdx = getNameIndex(c.name);
  for (let i = 0; i < c.coords.length - 1; i++) {
    const ptA = c.coords[i];
    const ptB = c.coords[i + 1];
    const nodeA = getNodeIndex(ptA);
    const nodeB = getNodeIndex(ptB);
    const segCoords = [ptA, ptB];
    const lengthM = wayLengthM(segCoords);

    // [nameIdx, fromNode, toNode, roadType, lanes, maxSpeed, lengthM, isOneWay, layer, coords, alts, twins, isLink]
    segments.push([
      nameIdx,
      nodeA,
      nodeB,
      c.type,
      c.lanes,
      c.speed,
      lengthM,
      false, // two-way
      0,
      segCoords,
      [],
      [],
      false,
    ]);
    addedCount++;
  }
}

console.log(`Added ${addedCount} new outer arterial segments.`);

// Update dataset
dataset.city.bbox = [-12.24, -77.17, -11.90, -76.88]; // Expanded metropolitan box
dataset.names = names;
dataset.nodes = nodes;
dataset.segments = segments;
dataset.stats.segmentCount = segments.length;
dataset.stats.nodeCount = nodes.length;
dataset.stats.totalKm = Math.round(segments.reduce((acc, s) => acc + s[6], 0) / 1000);

const v1Path = path.join(process.cwd(), 'public/data/cities/lima/v1/roads.json');
fs.writeFileSync(v1Path, JSON.stringify(dataset));
fs.writeFileSync(v2Path, JSON.stringify(dataset));

console.log(`Successfully updated Lima dataset!`);
console.log(`Final Stats: ${dataset.stats.segmentCount} streets, ${dataset.stats.totalKm} km, ${names.length} named avenues.`);
