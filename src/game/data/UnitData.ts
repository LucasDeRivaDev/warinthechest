// ============================================================
// DATOS DE UNIDADES — War in the Chest
//
// Unidades basadas en las cartas REALES del juego War Chest.
// Sin ATK/DEF — todo combate quita 1 moneda del stack.
// coinsInBag = cuántas monedas da ese tipo cuando se recluta (x4, x5…)
// ============================================================

import { UnitStats, UnitType } from '../../types/game.types';

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  swordsman: {
    type: 'swordsman',
    name: 'Espadachín',
    shortName: 'ES',
    color: 0x4477dd,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Infantería equilibrada.',
    tacticDescription: 'Después de atacar, puede moverse 1 hex.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  pikeman: {
    type: 'pikeman',
    name: 'Piquero',
    shortName: 'PI',
    color: 0x99bb11,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 4,
    description: 'Defensor especializado con pica.',
    tacticDescription: 'Pasiva: cuando el Piquero es atacado por una unidad adyacente, esa unidad pierde 1 moneda de su stack.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  archer: {
    type: 'archer',
    name: 'Arquero',
    shortName: 'AR',
    color: 0x22cc88,
    moveRange: 1,
    attackRange: 0,   // ← NO puede atacar normalmente
    coinsInBag: 4,
    description: 'No puede atacar con acción normal.',
    tacticDescription: 'Táctica: ataca una unidad enemiga a exactamente 2 hexes de distancia.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  light_cavalry: {
    type: 'light_cavalry',
    name: 'Cab. Ligera',
    shortName: 'CL',
    color: 0xffaa22,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Caballería rápida y maniobrable.',
    tacticDescription: 'Táctica: mueve 2 espacios (en lugar de 1).',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  royal_guard: {
    type: 'royal_guard',
    name: 'Guardia Real',
    shortName: 'GR',
    color: 0xaa55ff,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Guardián resistente del rey.',
    tacticDescription: 'Táctica: descartá la Moneda Real para mover la Guardia Real 1 o 2 espacios a una Ubicación de Control.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  berserker: {
    type: 'berserker',
    name: 'Berserker',
    shortName: 'BE',
    color: 0xff3333,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Guerrero feroz y resistente.',
    tacticDescription: 'Tras maniobrar el Berserker, podés reforzarlo descartando una moneda reforzada de su stack. Puede repetirse pero no se puede quitar la última.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  warrior_priest: {
    type: 'warrior_priest',
    name: 'Sacerdote',
    shortName: 'SP',
    color: 0xffdd66,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 4,
    description: 'Guerrero sagrado multifunción.',
    tacticDescription: 'Después de que el Sacerdote ataque o controle, sacá una moneda de tu bolsa y usala inmediatamente para cualquier acción.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  mercenary: {
    type: 'mercenary',
    name: 'Mercenario',
    shortName: 'ME',
    color: 0xcc6633,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Soldado de fortuna versátil.',
    tacticDescription: 'Después de reclutar un Mercenario, podés maniobrar tu unidad Mercenario inmediatamente.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  ensign: {
    type: 'ensign',
    name: 'Bandera',
    shortName: 'BA',
    color: 0x33ccff,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Porta-estandarte que lidera aliados.',
    tacticDescription: 'Táctica: elegí una unidad aliada a 2 espacios de la Bandera. Esa unidad realiza un movimiento normal a 2 espacios de la Bandera.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  scout: {
    type: 'scout',
    name: 'Explorador',
    shortName: 'SC',
    color: 0xff7733,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Despliegue flexible junto a aliados.',
    tacticDescription: 'Despliegue especial: puede desplegarse adyacente a CUALQUIER unidad aliada (sin necesitar punto de control).',
    canHaveMultiple: false,
    flexibleDeploy: true,
  },
  cavalry: {
    type: 'cavalry',
    name: 'Caballería',
    shortName: 'CA',
    color: 0xcc7700,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 4,
    description: 'Caballería pesada de carga.',
    tacticDescription: 'Táctica: mover 1 hex Y luego atacar, todo en una sola acción.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  crossbowman: {
    type: 'crossbowman',
    name: 'Ballestero',
    shortName: 'BL',
    color: 0x336699,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Puede atacar normalmente o a distancia.',
    tacticDescription: 'Táctica: ataca a 2 hexes en línea recta. No puede haber unidades bloqueando entre medio.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  footman: {
    type: 'footman',
    name: 'Peón',
    shortName: 'PE',
    color: 0x44aa44,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Infantería coordinada. Podés tener 2 en el tablero.',
    tacticDescription: 'Táctica: mueve DOS Peones distintos, cada uno 1 hex, con una sola moneda.',
    canHaveMultiple: true,
    flexibleDeploy: false,
  },
  knight: {
    type: 'knight',
    name: 'Caballero',
    shortName: 'KN',
    color: 0x999999,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 4,
    description: 'Tanque que inmoviliza enemigos cercanos.',
    tacticDescription: 'Pasiva: los enemigos adyacentes al Caballero no pueden moverse (están clavados en el lugar).',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  lancer: {
    type: 'lancer',
    name: 'Lancero',
    shortName: 'LA',
    color: 0xdd4422,
    moveRange: 1,
    attackRange: 0,  // ← SOLO ataca con táctica (carga)
    coinsInBag: 4,
    description: 'Solo ataca mediante su táctica de carga.',
    tacticDescription: 'Táctica: avanzar 1 o 2 hexes en línea recta y luego atacar una unidad adyacente.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
  marshal: {
    type: 'marshal',
    name: 'Mariscal',
    shortName: 'MA',
    color: 0xddcc22,
    moveRange: 1,
    attackRange: 1,
    coinsInBag: 5,
    description: 'Comandante que coordina ataques aliados.',
    tacticDescription: 'Táctica: elegí una unidad aliada cercana (no Arquero ni Lancero) y hacela atacar normalmente.',
    canHaveMultiple: false,
    flexibleDeploy: false,
  },
};

// Monedas por tipo cuando se recluta (del supply al descarte)
export const RECRUIT_COINS = 2;

// Monedas Royal por jugador en la bolsa inicial
export const ROYAL_COINS_PER_PLAYER = 2;

// Monedas que roba el jugador al inicio de su turno
export const COINS_PER_TURN = 3;

// Marcadores necesarios para ganar
export const CONTROL_POINTS_TO_WIN = 6;

// Colores y nombres de jugadores
// P0 = dorado (sur/abajo, jugador humano) — P1 = azul pizarra (norte/arriba, IA)
export const PLAYER_COLORS: [number, number] = [0xcc9920, 0x4a6aaa];
export const PLAYER_NAMES: [string, string]   = ['Jugador (Azul)', 'IA (Rojo)'];

// Todos los tipos disponibles para el draft (16 unidades del juego base)
export const ALL_UNIT_TYPES: UnitType[] = [
  'swordsman', 'pikeman', 'archer', 'light_cavalry',
  'royal_guard', 'berserker', 'warrior_priest', 'mercenary',
  'ensign', 'scout',
  'cavalry', 'crossbowman', 'footman', 'knight', 'lancer', 'marshal',
];

// ---- Supply inicial (monedas disponibles para Reclutar) ----
// Se calcula a partir de coinsInBag: supply = coinsInBag - 1 (el 1 va a la bolsa inicial post-draft)
export function makeInitialSupply(draftedTypes: UnitType[]): Record<UnitType, number> {
  const supply: Record<UnitType, number> = {
    swordsman: 0, pikeman: 0, archer: 0, light_cavalry: 0,
    royal_guard: 0, berserker: 0, warrior_priest: 0, mercenary: 0,
    ensign: 0, scout: 0,
    cavalry: 0, crossbowman: 0, footman: 0, knight: 0, lancer: 0, marshal: 0,
  };
  for (const type of draftedTypes) {
    // Supply = coinsInBag - 2 (los 2 primeros van al bag inicial)
    // Mínimo 0
    supply[type] = Math.max(0, UNIT_STATS[type].coinsInBag - 2);
  }
  return supply;
}
