// ============================================================
// MATEMÁTICA HEXAGONAL — War in the Chest
//
// Tablero DIAMANTE fiel al War Chest 2 jugadores:
// - 5 columnas (q de -2 a +2)
// - 9 filas (r de -4 a +4)
// - Forma de diamante: abs(q)<=2, abs(r)<=4, abs(q+r)<=4
// - 39 hexes en total
// ============================================================

import { HexCoord } from '../types/game.types';

// Tamaño del hexágono en píxeles (ajustado para el tablero diamante)
export const HEX_SIZE = 38;
export const SQRT3 = Math.sqrt(3);

// Convierte axial (q, r) → píxeles, pointy-top
export function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * (SQRT3 * q + (SQRT3 / 2) * r),
    y: HEX_SIZE * (1.5 * r),
  };
}

// Convierte píxeles → axial (redondea al hex más cercano)
export function pixelToHex(x: number, y: number): HexCoord {
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / HEX_SIZE;
  const r = ((2 / 3) * y) / HEX_SIZE;
  return cubeRound(q, r);
}

function cubeRound(q: number, r: number): HexCoord {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

// Vértices de un hexágono pointy-top
export function hexCorners(cx: number, cy: number, size = HEX_SIZE) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) };
  });
}

// Claves para Map
export function hexKey(q: number, r: number): string { return `${q},${r}`; }
export function coordKey(c: HexCoord): string { return `${c.q},${c.r}`; }

// Distancia en hexágonos
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// Direcciones de los 6 vecinos
export const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export function hexNeighbors(c: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((d) => ({ q: c.q + d.q, r: c.r + d.r }));
}

// Todos los hexes dentro de `range` pasos (excluye centro)
export function hexesInRange(center: HexCoord, range: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -range; q <= range; q++) {
    for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
      if (q === 0 && r === 0) continue;
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

// ---- TABLERO DIAMANTE (fiel a War Chest 2J) ----
// Restricción: abs(q)<=2, abs(r)<=4, abs(q+r)<=4 → 39 hexes

export function generateDiamondBoard(): HexCoord[] {
  const hexes: HexCoord[] = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.abs(q + r) <= 4) {
        hexes.push({ q, r });
      }
    }
  }
  return hexes;
}

export function isOnBoard(c: HexCoord): boolean {
  return (
    Math.abs(c.q) <= 2 &&
    Math.abs(c.r) <= 4 &&
    Math.abs(c.q + c.r) <= 4
  );
}

// Mantener isInBoard como alias para compatibilidad
export function isInBoard(c: HexCoord, _radius?: number): boolean {
  return isOnBoard(c);
}

// Circular board (para compatibilidad, no se usa en el juego principal)
export function generateHexBoard(radius: number): HexCoord[] {
  const hexes: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
}
