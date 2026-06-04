// ============================================================
// TIPOS — War in the Chest
// Mecánicas basadas en War Chest (AEG, 2018)
// ============================================================

export interface HexCoord { q: number; r: number; }

// ---- UNIDADES ----
// Basadas en las cartas reales del juego (foto de referencia)
export type UnitType =
  | 'swordsman'     // Espadachín
  | 'pikeman'       // Piquero
  | 'archer'        // Arquero
  | 'light_cavalry' // Caballería Ligera
  | 'royal_guard'   // Guardia Real
  | 'berserker'     // Berserker
  | 'warrior_priest'// Sacerdote Guerrero
  | 'mercenary'     // Mercenario
  | 'ensign'        // Bandera
  | 'scout'         // Explorador
  | 'cavalry'       // Caballería (pesada)
  | 'crossbowman'   // Ballestero
  | 'footman'       // Peón
  | 'knight'        // Caballero
  | 'lancer'        // Lancero
  | 'marshal';      // Mariscal

export type PlayerIndex = 0 | 1;

export type CoinKind = 'unit' | 'royal';

export interface Coin {
  id: string;
  kind: CoinKind;
  unitType?: UnitType;
}

export interface Unit {
  id: string;
  type: UnitType;
  owner: PlayerIndex;
  stack: number;
  coins: Coin[];
  position: HexCoord;
  hasMoved: boolean;
  hasActed: boolean;
}

export interface UnitStats {
  type: UnitType;
  name: string;
  shortName: string;
  color: number;
  moveRange: number;
  attackRange: number;
  coinsInBag: number;       // Monedas en la bolsa al ser reclutado (x4, x5, etc)
  description: string;
  tacticDescription: string;
  canHaveMultiple: boolean;
  flexibleDeploy: boolean;
}

export type HexTileType = 'normal' | 'controlLocation';

export interface HexTile {
  coord: HexCoord;
  tileType: HexTileType;
  controlledBy: PlayerIndex | null;
  unit: Unit | null;
}

export type FaceUpAction =
  | 'deploy' | 'move' | 'attack' | 'bolster' | 'control' | 'tactic';

export type FaceDownAction =
  | 'recruit' | 'initiative' | 'pass';

export type ActionType = FaceUpAction | FaceDownAction;

// Fases del juego — draft se maneja antes del estado GameState
export type GamePhase = 'playing' | 'gameover';

export interface GameState {
  phase: GamePhase;
  round: number;
  currentPlayer: PlayerIndex;
  initiativeHolder: PlayerIndex;
  tiles: Map<string, HexTile>;
  bags:     Coin[][];
  hands:    Coin[][];
  discards: Coin[][];
  coinSupply: Record<UnitType, number>[];
  controlMarkersOnBoard: [number, number];
  coinsDestroyed: [number, number];
  usedCoinIds: Set<string>;
  selectedCoinId: string | null;
  pendingAction: ActionType | null;
  validTargets: HexCoord[];
  winner: PlayerIndex | null;
  winReason: string;
}

// ---- FASE DE DRAFT ----
export interface DraftState {
  pool: UnitType[];                      // 8 tipos disponibles para elegir
  playerDrafts: [UnitType[], UnitType[]]; // lo que eligió cada jugador
  pickOrder: PlayerIndex[];              // secuencia de turnos de elección
  currentPickIndex: number;             // índice actual en pickOrder
}

export interface UIState {
  phase: GamePhase | 'draft';
  round: number;
  currentPlayer: PlayerIndex;
  initiativeHolder: PlayerIndex;
  hands: Coin[][];
  bagSizes: [number, number];
  discardSizes: [number, number];
  coinSupply: Record<UnitType, number>[];
  controlMarkersOnBoard: [number, number];
  coinsDestroyed: [number, number];
  selectedCoinId: string | null;
  pendingAction: ActionType | null;
  usedCoinIds: string[];
  winner: PlayerIndex | null;
  winReason: string;
  message: string;
  selectedCoinKind?: CoinKind;
  selectedUnitType?: UnitType;
  // Draft
  draft?: DraftState;
}
