// ============================================================
// DATOS DEL TABLERO — War in the Chest
//
// Tablero DIAMANTE fiel al War Chest 2 jugadores:
// abs(q)<=2, abs(r)<=4, abs(q+r)<=4 → 39 hexes
//
// 9 puntos de control distribuidos simétricamente.
// Simetría: (q,r) ↔ (-q,-r) refleja P0↔P1.
//
// Jugador 0 = zona SUR (r positivo, parte de abajo)
// Jugador 1 = zona NORTE (r negativo, parte de arriba)
// ============================================================

import { HexCoord } from '../../types/game.types';

// Radio del tablero (para compatibilidad con AIPlayer)
export const BOARD_RADIUS = 4;

// 9 puntos de control simétricos
export const CONTROL_POINTS: HexCoord[] = [
  { q:  0, r:  0 },   // Centro exacto
  { q:  2, r: -2 },   // Esquina superior derecha  (↔ {-2,2})
  { q: -2, r:  2 },   // Esquina inferior izquierda
  { q:  1, r: -3 },   // Zona alta derecha          (↔ {-1,3})
  { q: -1, r:  3 },   // Zona baja izquierda
  { q:  0, r: -2 },   // Centro superior            (↔ {0,2})
  { q:  0, r:  2 },   // Centro inferior
  { q: -1, r: -1 },   // Medio izquierdo            (↔ {1,1})
  { q:  1, r:  1 },   // Medio derecho
];

// Posiciones de inicio — Player 0 (sur, abajo)
export const PLAYER0_START_HEXES: HexCoord[] = [
  { q: -1, r:  4 },
  { q:  0, r:  4 },
];

// Posiciones de inicio — Player 1 (norte, arriba)
export const PLAYER1_START_HEXES: HexCoord[] = [
  { q:  0, r: -4 },
  { q:  1, r: -4 },
];
