// ============================================================
// GAME SCENE — War in the Chest (1:1 War Chest mechanics)
//
// FLUJO:
//   1. DRAFT: 8 tipos aleatorios boca arriba → snake draft 1-2-2-1
//   2. SETUP: colocar 2 unidades iniciales por jugador
//   3. PLAYING: turnos alternados con mecánicas War Chest exactas
//
// COMBATE: 1 ataque = 1 moneda del stack eliminada permanentemente
// CONTROL: acción explícita, marcador persiste al mover la unidad
// ============================================================

import Phaser from 'phaser';
import {
  GameState, HexTile, HexCoord, Unit, Coin,
  ActionType, UnitType, PlayerIndex, UIState, CoinKind, DraftState
} from '../../types/game.types';
import {
  hexToPixel, pixelToHex, hexCorners, coordKey,
  hexDistance, hexesInRange, isOnBoard, hexNeighbors,
  HEX_DIRECTIONS, HEX_SIZE, generateDiamondBoard,
} from '../HexMath';
import {
  CONTROL_POINTS, PLAYER0_START_HEXES, PLAYER1_START_HEXES
} from '../data/BoardData';
import {
  UNIT_STATS, PLAYER_COLORS, PLAYER_NAMES,
  COINS_PER_TURN, CONTROL_POINTS_TO_WIN, ROYAL_COINS_PER_PLAYER,
  ALL_UNIT_TYPES, makeInitialSupply,
} from '../data/UnitData';
import { BagSystem } from '../systems/BagSystem';
import { AIPlayer } from '../ai/AIPlayer';
import { GameBridge } from '../GameBridge';

// ---- Paleta — inspirada en el tablero real de War Chest ----
const C = {
  // Hexes base
  HEX_NORMAL:       0xe8ddb0,  // crema cálida
  HEX_CONTROL:      0xdcc87a,  // crema dorada (puntos de control)
  HEX_BORDER:       0x7a5515,  // marrón cálido
  HEX_CTRL_BORDER:  0x997722,  // dorado oscuro (control sin dueño)
  // Overlays de acción (se dibujan encima del crema)
  OVL_MOVE:    0x33cc55,
  OVL_ATTACK:  0xdd3311,
  OVL_DEPLOY:  0x2266ff,
  OVL_BOLSTER: 0xff8822,
  OVL_CTRL:    0xffdd00,
};

// Táctica de 2 pasos
interface TacticStep {
  coinId:   string;
  unitType: UnitType;
  player:   PlayerIndex;
  phase:
    | 'cav_move'       | 'cav_attack'      // light_cavalry (existente)
    | 'sw_attack'      | 'sw_move'         // swordsman (existente)
    | 'cavalry_move'   | 'cavalry_attack'  // cavalry: mover + atacar
    | 'lancer_move'    | 'lancer_attack'   // lancer: carga en línea + atacar
    | 'footman_move1'  | 'footman_move2'   // footman: mover 2 peones
    | 'marshal_select' | 'marshal_attack'; // marshal: habilitar ataque aliado
  unitPos?:  HexCoord;  // pos del unit siendo controlado en táctica multi-paso
}

let unitIdCounter = 0;
let startCoinId   = 5000;

function mkCoin(type: UnitType): Coin {
  return { id: `sc${startCoinId++}`, kind: 'unit', unitType: type };
}

function mkUnit(type: UnitType, owner: PlayerIndex, pos: HexCoord): Unit {
  const coin = mkCoin(type);
  return {
    id: `u${++unitIdCounter}`,
    type, owner,
    stack: 1,
    coins: [coin],
    position: { ...pos },
    hasMoved: false, hasActed: false,
  };
}

export class GameScene extends Phaser.Scene {
  private gBoard!:  Phaser.GameObjects.Graphics;
  private gUnits!:  Phaser.GameObjects.Graphics;
  private gFx!:     Phaser.GameObjects.Graphics;
  private unitLabels: Map<string, Phaser.GameObjects.Text> = new Map();

  private state!: GameState;
  private bag!:   BagSystem;
  private ai!:    AIPlayer;

  private cx!: number;
  private cy!: number;
  private isAnimating = false;

  // Estado local
  private tacticStep:  TacticStep | null = null;
  private recruitWait: { coinId: string; player: PlayerIndex } | null = null;

  // ---- DRAFT ----
  private draft!: DraftState;
  private inDraft = true;

  constructor() { super({ key: 'GameScene' }); }

  // ==========================================================
  // LIFECYCLE
  // ==========================================================

  create(): void {
    const { width, height } = this.cameras.main;
    // Centrado para tablero diamante 39 hexes (más estrecho, más alto)
    this.cx = width  * 0.40;
    this.cy = height * 0.52;

    this.gBoard = this.add.graphics();
    this.gUnits = this.add.graphics();
    this.gFx    = this.add.graphics();

    this.ai = new AIPlayer();

    GameBridge.on('draftUnitSelected',  (t: UnitType)     => this._onDraftPick(t));
    GameBridge.on('coinClicked',        (c: Coin)         => this._onCoinClicked(c));
    GameBridge.on('actionChosen',       (a: ActionType)   => this._onActionChosen(a));
    GameBridge.on('recruitTypeChosen',  (t: UnitType)     => this._onRecruitTypeChosen(t));
    GameBridge.on('endTurnRequested',   ()                => this._endTurn());
    GameBridge.on('restartRequested',   ()                => this._restartGame());

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) =>
      this._handleBoardClick(ptr.x, ptr.y)
    );

    this._startDraft();
  }

  // ==========================================================
  // DRAFT — Fase de selección de ejércitos
  // ==========================================================

  private _startDraft(): void {
    this.inDraft = true;

    // Mezclar y tomar 8 tipos aleatorios del pool
    const shuffled = [...ALL_UNIT_TYPES].sort(() => Math.random() - 0.5);
    const pool = shuffled.slice(0, 8);

    // Orden de elección: P0:1, P1:2, P0:2, P1:1 (snake draft, 3 cada uno)
    const pickOrder: PlayerIndex[] = [0, 1, 1, 0, 0, 1];

    this.draft = {
      pool,
      playerDrafts: [[], []],
      pickOrder,
      currentPickIndex: 0,
    };

    // Dibujar tablero vacío de fondo para contexto
    this._buildEmptyBoard();
    this.drawAll();
    this._emitUI('¡Comenzá el Draft! Elegí tus unidades.', undefined, undefined, this.draft);
  }

  private _onDraftPick(type: UnitType): void {
    if (!this.inDraft) return;
    const d = this.draft;
    const currentPlayer = d.pickOrder[d.currentPickIndex];

    // IA juega automáticamente sus picks → solo acepta picks del jugador 0
    if (currentPlayer !== 0) return;
    if (!d.pool.includes(type) || d.playerDrafts[currentPlayer].includes(type)) return;

    this._doDraftPick(currentPlayer, type);
  }

  private _doDraftPick(player: PlayerIndex, type: UnitType): void {
    const d = this.draft;
    d.playerDrafts[player].push(type);
    d.currentPickIndex++;

    this.drawAll();

    if (d.currentPickIndex >= d.pickOrder.length) {
      // Draft completo
      this._finalizeDraft();
      return;
    }

    const nextPlayer = d.pickOrder[d.currentPickIndex];

    if (nextPlayer === 1) {
      // IA elige automáticamente (después de una pausa)
      const msg = `Ronda del draft ${d.currentPickIndex}/${d.pickOrder.length} — IA eligiendo...`;
      this._emitUI(msg, undefined, undefined, d);
      this.time.delayedCall(900, () => this._aiDraftPick());
    } else {
      const msg = `Tu turno de elegir (${d.playerDrafts[0].length + 1}/3)`;
      this._emitUI(msg, undefined, undefined, d);
    }
  }

  private _aiDraftPick(): void {
    const d = this.draft;
    if (d.pickOrder[d.currentPickIndex] !== 1) return;

    // IA elige el tipo más "poderoso" disponible (según coinsInBag como proxy)
    const available = d.pool.filter(
      (t) => !d.playerDrafts[0].includes(t) && !d.playerDrafts[1].includes(t)
    );
    if (available.length === 0) { this._finalizeDraft(); return; }

    // Priorizar tipos con más monedas (x5 > x4)
    available.sort((a, b) => UNIT_STATS[b].coinsInBag - UNIT_STATS[a].coinsInBag);
    const chosen = available[0];
    this._doDraftPick(1, chosen);
  }

  private _finalizeDraft(): void {
    this.inDraft = false;
    const [p0types, p1types] = this.draft.playerDrafts;

    // Inicializar BagSystem con las bolsas de cada jugador
    this.bag = new BagSystem(
      [makeInitialSupply(p0types), makeInitialSupply(p1types)],
      [p0types, p1types]
    );

    // Construir estado del juego
    this.state = this._buildGameState([p0types, p1types]);

    this.drawAll();
    this._startTurn();
    this._emitUI('¡Draft completado! La partida comienza.', undefined, undefined, undefined);
  }

  // ==========================================================
  // ESTADO INICIAL
  // ==========================================================

  private _buildEmptyBoard(): void {
    // Solo construir tiles vacías para el fondo del draft
    const hexes = generateDiamondBoard();
    const cpSet = new Set(CONTROL_POINTS.map(coordKey));
    const tiles = new Map<string, HexTile>();
    for (const coord of hexes) {
      tiles.set(coordKey(coord), {
        coord,
        tileType: cpSet.has(coordKey(coord)) ? 'controlLocation' : 'normal',
        controlledBy: null,
        unit: null,
      });
    }
    // Crear un estado mínimo para poder dibujar el board
    if (!this.state) {
      this.state = {
        phase: 'playing',
        round: 1, currentPlayer: 0, initiativeHolder: 0,
        tiles,
        bags: [[], []], hands: [[], []], discards: [[], []],
        coinSupply: [{} as any, {} as any],
        controlMarkersOnBoard: [0, 0],
        coinsDestroyed: [0, 0],
        usedCoinIds: new Set(),
        selectedCoinId: null, pendingAction: null, validTargets: [],
        winner: null, winReason: '',
      };
    } else {
      this.state.tiles = tiles;
    }
  }

  private _buildGameState(
    playerTypes: [UnitType[], UnitType[]]
  ): GameState {
    const hexes = generateDiamondBoard();
    const tiles = new Map<string, HexTile>();
    const cpSet = new Set(CONTROL_POINTS.map(coordKey));

    for (const coord of hexes) {
      tiles.set(coordKey(coord), {
        coord,
        tileType: cpSet.has(coordKey(coord)) ? 'controlLocation' : 'normal',
        controlledBy: null,
        unit: null,
      });
    }

    // Colocar 2 unidades iniciales por jugador (primeros 2 tipos elegidos)
    for (let p = 0; p < 2; p++) {
      const startHexes = p === 0 ? PLAYER0_START_HEXES : PLAYER1_START_HEXES;
      const types = playerTypes[p];
      for (let i = 0; i < Math.min(2, types.length, startHexes.length); i++) {
        const tile = tiles.get(coordKey(startHexes[i]));
        if (tile) tile.unit = mkUnit(types[i], p as PlayerIndex, startHexes[i]);
      }
    }

    return {
      phase: 'playing',
      round: 1,
      currentPlayer: 0,
      initiativeHolder: 0,
      tiles,
      bags:     this.bag.bags,
      hands:    this.bag.hands,
      discards: this.bag.discards,
      coinSupply: this.bag.coinSupply,
      controlMarkersOnBoard: [0, 0],
      coinsDestroyed: [0, 0],
      usedCoinIds: new Set(),
      selectedCoinId: null, pendingAction: null, validTargets: [],
      winner: null, winReason: '',
    };
  }

  // ==========================================================
  // FLUJO DE TURNO
  // ==========================================================

  private _startTurn(): void {
    const p = this.state.currentPlayer;

    this.state.tiles.forEach((tile) => {
      if (tile.unit?.owner === p) {
        tile.unit.hasMoved = false;
        tile.unit.hasActed = false;
      }
    });

    this.bag.drawCoins(p, COINS_PER_TURN);
    this._syncBag();

    this.state.usedCoinIds   = new Set();
    this.state.pendingAction = null;
    this.state.selectedCoinId = null;
    this.state.validTargets  = [];
    this.tacticStep  = null;
    this.recruitWait = null;

    this._animateDraw(p, () => {
      this.drawAll();
      const msg = p === 0
        ? `Ronda ${this.state.round} — Tu turno. Elegí una moneda.`
        : `Ronda ${this.state.round} — IA jugando...`;
      this._emitUI(msg);
      if (p === 1) this.time.delayedCall(600, () => this._runAITurn());
    });
  }

  private _endTurn(): void {
    if (this.isAnimating || this.inDraft) return;
    const p = this.state.currentPlayer;
    this.bag.discardHand(p);
    this._syncBag();

    const next: PlayerIndex = p === 0 ? 1 : 0;
    this.state.currentPlayer = next;
    if (next === this.state.initiativeHolder) this.state.round++;
    this._startTurn();
  }

  private _syncBag(): void {
    this.state.bags      = this.bag.bags;
    this.state.hands     = this.bag.hands;
    this.state.discards  = this.bag.discards;
    this.state.coinSupply = this.bag.coinSupply;
  }

  // ==========================================================
  // TURNO DE IA
  // ==========================================================

  private async _runAITurn(): Promise<void> {
    if (this.state.currentPlayer !== 1) return;
    const actions = this.ai.calculateTurn(this.state);

    for (const act of actions) {
      if (this.state.winner) break;
      await this._waitMs(480);
      const coin = this.state.hands[1].find((c) => c.id === act.coinId);
      if (!coin || this.state.usedCoinIds.has(act.coinId)) continue;

      if (act.action === 'deploy' && act.targetCoord) {
        await this._executeDeploy(1, coin, act.targetCoord);
      } else if (act.action === 'move' && act.targetCoord) {
        const unit = this._findUnit(coin.unitType!, 1, 'move', act.targetCoord);
        if (unit) await this._executeMove(unit, act.targetCoord, act.coinId);
      } else if (act.action === 'attack' && act.targetCoord) {
        const atk = this._findUnit(coin.unitType!, 1, 'attack', act.targetCoord);
        if (atk) await this._executeAttack(atk, act.targetCoord, act.coinId);
      } else if (act.action === 'control' && act.targetCoord) {
        await this._executeControl(1, act.targetCoord, act.coinId);
      } else if (act.action === 'bolster' && act.targetCoord) {
        const tgt = this._unitAt(act.targetCoord, 1, coin.unitType);
        if (tgt) await this._executeBolster(1, coin, tgt);
      } else if (act.action === 'recruit' && coin.unitType) {
        await this._executeRecruit(1, coin);
      } else {
        this._markUsed(act.coinId);
      }
    }
    await this._waitMs(300);
    this._endTurn();
  }

  private _waitMs(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  // ==========================================================
  // INPUT DEL JUGADOR
  // ==========================================================

  private _onCoinClicked(coin: Coin): void {
    if (this.state.currentPlayer !== 0 || this.state.winner || this.inDraft) return;
    if (this.state.usedCoinIds.has(coin.id)) return;

    if (this.state.selectedCoinId === coin.id) { this._clearSel(); return; }

    this.tacticStep = null;
    this.recruitWait = null;
    this.state.selectedCoinId = coin.id;
    this.state.pendingAction  = null;
    this.state.validTargets   = [];

    const label = coin.kind === 'royal' ? '👑 Moneda Real'
      : UNIT_STATS[coin.unitType!].name;
    this._emitUI(`${label} seleccionada. Elegí una acción.`, coin.kind, coin.unitType);
    this.drawAll();
  }

  private _onActionChosen(action: ActionType): void {
    if (this.state.currentPlayer !== 0 || !this.state.selectedCoinId || this.inDraft) return;
    const coinId = this.state.selectedCoinId;
    const coin = this.state.hands[0].find((c) => c.id === coinId);
    if (!coin) return;

    // ---- BOCA ABAJO (cualquier moneda) ----
    if (action === 'pass') {
      this._useDiscard(0, coin, coinId);
      this._emitUI('Moneda descartada (pass).');
      return;
    }
    if (action === 'initiative') {
      this.state.initiativeHolder = 0;
      this._useDiscard(0, coin, coinId);
      this._emitUI('¡Tomaste la iniciativa! Salís primero la próxima ronda.');
      return;
    }
    if (action === 'recruit') {
      if (coin.kind === 'royal') {
        this.recruitWait = { coinId, player: 0 };
        this.state.pendingAction = 'recruit';
        this._emitUI('¿Qué tipo de unidad reclutás?');
        this.drawAll();
      } else if (coin.unitType) {
        this._executeRecruit(0, coin).then(() => {
          this._emitUI(`Reclutaste ${UNIT_STATS[coin.unitType!].name}.`);
        });
      }
      return;
    }

    // ---- BOCA ARRIBA — Royal no puede ----
    if (coin.kind === 'royal') {
      this._emitUI('La Moneda Real solo puede usarse boca abajo.');
      return;
    }
    const type = coin.unitType!;

    // Tácticas de 2 pasos
    if (action === 'tactic') {
      this._startTactic(type, coinId, coin);
      return;
    }

    // Acciones normales con targets
    let targets: HexCoord[] = [];
    if (action === 'move')    targets = this._targetsMove(type, 0);
    if (action === 'attack')  targets = this._targetsAttack(type, 0);
    if (action === 'deploy')  targets = this._targetsDeploy(type, 0);
    if (action === 'bolster') targets = this._targetsBolster(type, 0);
    if (action === 'control') targets = this._targetsControl(0);

    if (targets.length === 0) {
      const why: Partial<Record<ActionType, string>> = {
        move:    'No hay hexes libres para mover.',
        attack:  type === 'archer'  ? 'El Arquero no puede atacar normalmente. Usá Táctica.'
               : type === 'lancer'  ? 'El Lancero no puede atacar normalmente. Usá Táctica (carga).'
               : 'No hay enemigos en rango.',
        deploy:  'No tenés puntos de control propios libres para desplegar.',
        bolster: 'No hay unidades del mismo tipo en tablero.',
        control: 'No tenés unidades en puntos de control sin tu bandera.',
      };
      this._emitUI(why[action] ?? 'Sin objetivos válidos.');
      return;
    }

    this.state.pendingAction = action;
    this.state.validTargets  = targets;
    const msgs: Partial<Record<ActionType,string>> = {
      move: '↔ Click en un hex verde para mover.',
      attack: '⚔ Click en un enemigo para atacar.',
      deploy: '+ Click en un punto de control propio para desplegar.',
      bolster: '⬆ Click en una unidad aliada del mismo tipo.',
      control: '✦ Click en el punto de control donde está tu unidad.',
    };
    this._emitUI(msgs[action] ?? 'Click en un objetivo.', 'unit', type);
    this.drawAll();
  }

  private _onRecruitTypeChosen(type: UnitType): void {
    if (!this.recruitWait) return;
    const { coinId, player } = this.recruitWait;
    const coin = this.state.hands[player].find((c) => c.id === coinId);
    if (!coin) return;

    const added = this.bag.recruit(player, type);
    this.bag.addToDiscard(player, coin);
    this.bag.removeFromHand(player, coinId);
    this._syncBag();
    this._markUsed(coinId);
    this.recruitWait = null;
    this.state.pendingAction = null;
    this._clearSel();
    this._emitUI(`Reclutaste +${added} ${UNIT_STATS[type].name} al descarte.`);
    this.drawAll();
  }

  private _handleBoardClick(sx: number, sy: number): void {
    if (this.isAnimating || this.inDraft || this.state.winner) return;
    if (this.state.currentPlayer !== 0) return;

    const coord = pixelToHex(sx - this.cx, sy - this.cy);
    if (!isOnBoard(coord)) return;

    const { pendingAction, validTargets } = this.state;
    const isTarget = validTargets.some((t) => t.q === coord.q && t.r === coord.r);

    if (pendingAction && isTarget) {
      this._executePlayerAction(coord);
    } else {
      const tile = this.state.tiles.get(coordKey(coord));
      if (tile?.unit?.owner === 0) {
        this._selectUnitOn(coord);
      } else {
        this._clearSel();
      }
    }
  }

  private _selectUnitOn(coord: HexCoord): void {
    const tile = this.state.tiles.get(coordKey(coord));
    if (!tile?.unit || tile.unit.owner !== 0) return;
    const coin = this.state.hands[0].find(
      (c) => c.kind === 'unit' && c.unitType === tile.unit!.type
           && !this.state.usedCoinIds.has(c.id)
    );
    if (!coin) {
      this._emitUI(`Sin moneda disponible de ${UNIT_STATS[tile.unit.type].name}.`);
      return;
    }
    this.state.selectedCoinId = coin.id;
    this.state.pendingAction  = null;
    this.state.validTargets   = [];
    this._emitUI(`${UNIT_STATS[tile.unit.type].name} seleccionado.`, 'unit', tile.unit.type);
    this.drawAll();
  }

  private async _executePlayerAction(coord: HexCoord): Promise<void> {
    const { pendingAction, selectedCoinId } = this.state;
    if (!pendingAction || !selectedCoinId) return;
    const coin = this.state.hands[0].find((c) => c.id === selectedCoinId);
    if (!coin) return;
    const type = coin.unitType;

    // Tácticas multi-paso
    if (pendingAction === 'tactic' && this.tacticStep) {
      await this._doTacticStep(coin, coord);
      return;
    }

    // Tácticas de 1 solo paso (archer, crossbowman — no tienen tacticStep)
    if (pendingAction === 'tactic' && !this.tacticStep && type) {
      await this._executeSingleStepTactic(type, 0, coin, coord);
      return;
    }

    if (pendingAction === 'move' && type) {
      const unit = this._findUnit(type, 0, 'move', coord);
      if (unit) await this._executeMove(unit, coord, selectedCoinId);
    } else if (pendingAction === 'attack' && type) {
      const atk = this._findUnit(type, 0, 'attack', coord);
      if (atk) await this._executeAttack(atk, coord, selectedCoinId);
    } else if (pendingAction === 'deploy' && coin) {
      await this._executeDeploy(0, coin, coord);
    } else if (pendingAction === 'bolster' && coin && type) {
      const tgt = this._unitAt(coord, 0, type);
      if (tgt) await this._executeBolster(0, coin, tgt);
    } else if (pendingAction === 'control') {
      await this._executeControl(0, coord, selectedCoinId);
    }
  }

  // ==========================================================
  // TÁCTICAS
  // ==========================================================

  private _startTactic(type: UnitType, coinId: string, coin: Coin): void {
    if (type === 'light_cavalry') {
      // Táctica: mueve 2 espacios
      const targets = this._targetsMoveLong(type, 0, 2);
      if (targets.length === 0) { this._emitUI('Sin hexes para mover la Cab. Ligera.'); return; }
      this.tacticStep = { coinId, unitType: type, player: 0, phase: 'cav_move' };
      this.state.pendingAction = 'tactic';
      this.state.validTargets  = targets;
      this._emitUI('Cab. Ligera: ¿a dónde se mueve (hasta 2 hexes)?', 'unit', type);
      this.drawAll();

    } else if (type === 'swordsman') {
      // Táctica: ataca y luego se mueve
      const targets = this._targetsAttack('swordsman', 0);
      if (targets.length === 0) { this._emitUI('Sin enemigos para el Espadachín.'); return; }
      this.tacticStep = { coinId, unitType: type, player: 0, phase: 'sw_attack' };
      this.state.pendingAction = 'tactic';
      this.state.validTargets  = targets;
      this._emitUI('Espadachín: ¿a qué enemigo atacás? (luego podrás moverte)', 'unit', type);
      this.drawAll();

    } else if (type === 'archer') {
      // Táctica: ataque a exactamente 2 hexes (puede disparar sobre unidades)
      const targets = this._targetsArcherTactic(0);
      if (targets.length === 0) { this._emitUI('Sin objetivos a distancia 2 para el Arquero.'); return; }
      this.state.pendingAction = 'tactic';
      this.state.validTargets  = targets;
      this._emitUI('Arquero: click en un enemigo a distancia 2.', 'unit', 'archer');
      this.drawAll();

    } else if (type === 'cavalry') {
      // Táctica: mover 1 hex + atacar (todo en 1 acción)
      const targets = this._targetsMoveLong('cavalry', 0, 1);
      if (targets.length === 0) { this._emitUI('La Caballería no tiene hexes libres para moverse.'); return; }
      this.tacticStep = { coinId, unitType: type, player: 0, phase: 'cavalry_move' };
      this.state.pendingAction = 'tactic';
      this.state.validTargets  = targets;
      this._emitUI('Caballería (1/2): ¿a dónde se mueve?', 'unit', type);
      this.drawAll();

    } else if (type === 'crossbowman') {
      // Táctica: ataca a 2 hexes en línea recta sin obstáculo
      const targets = this._targetsCrossbowmanTactic(0);
      if (targets.length === 0) { this._emitUI('Sin objetivos a 2 hexes en línea para el Ballestero.'); return; }
      this.state.pendingAction = 'tactic';
      this.state.validTargets  = targets;
      this._emitUI('Ballestero: click en un enemigo a 2 hexes en línea recta.', 'unit', type);
      this.drawAll();

    } else if (type === 'lancer') {
      // Táctica: avanzar 1-2 hexes en línea recta y luego atacar
      const targets = this._targetsLancerMove(0);
      if (targets.length === 0) { this._emitUI('El Lancero no puede cargar (sin hexes libres en línea recta).'); return; }
      this.tacticStep = { coinId, unitType: type, player: 0, phase: 'lancer_move' };
      this.state.pendingAction = 'tactic';
      this.state.validTargets  = targets;
      this._emitUI('Lancero (1/2): ¿a dónde carga? (1 o 2 hexes en línea recta)', 'unit', type);
      this.drawAll();

    } else if (type === 'footman') {
      // Táctica: mover 2 Peones distintos con 1 sola moneda
      const footmenPositions: HexCoord[] = [];
      this.state.tiles.forEach((t) => {
        if (t.unit?.owner === 0 && t.unit.type === 'footman') footmenPositions.push(t.coord);
      });
      if (footmenPositions.length === 0) { this._emitUI('No hay Peones en el tablero para mover.'); return; }
      const firstPos = footmenPositions[0];
      const moveTargets = this._targetsMoveFromPos(firstPos, 1);
      if (moveTargets.length === 0) { this._emitUI('El Peón no tiene hexes libres para moverse.'); return; }
      this.tacticStep = { coinId, unitType: type, player: 0, phase: 'footman_move1', unitPos: firstPos };
      this.state.pendingAction = 'tactic';
      this.state.validTargets  = moveTargets;
      const total = footmenPositions.length;
      this._emitUI(`Peón (1/${total}): ¿a dónde se mueve?`, 'unit', type);
      this.drawAll();

    } else if (type === 'marshal') {
      // Táctica: elegí un aliado para que ataque normalmente (no arquero/lancero)
      const targets = this._targetsMarshalAllySelect(0);
      if (targets.length === 0) { this._emitUI('Sin aliados que puedan atacar usando el Mariscal.'); return; }
      this.tacticStep = { coinId, unitType: type, player: 0, phase: 'marshal_select' };
      this.state.pendingAction = 'tactic';
      this.state.validTargets  = targets;
      this._emitUI('Mariscal: elegí un aliado para que ataque.', 'unit', type);
      this.drawAll();

    } else if (type === 'knight') {
      // Pasiva: no tiene táctica activa
      this._emitUI('El Caballero no tiene táctica activa — su habilidad es pasiva (inmoviliza enemigos adyacentes).');

    } else {
      this._emitUI('Esta unidad no tiene táctica especial activa.');
    }
  }

  private async _doTacticStep(coin: Coin, coord: HexCoord): Promise<void> {
    if (!this.tacticStep) return;
    const ts = this.tacticStep;
    const p  = ts.player;

    // ---- light_cavalry: mover hasta 2 hexes ----
    if (ts.phase === 'cav_move') {
      const unit = this._findUnit('light_cavalry', p, 'move2', coord);
      if (!unit) return;
      this.isAnimating = true;
      await this._animateMove(unit.position, coord);
      this._doStateMove(unit, coord);
      this._markUsed(ts.coinId);
      this.isAnimating = false;
      this.tacticStep = null;
      this.state.pendingAction = null;
      this.state.validTargets  = [];
      this._clearSel();
      this.drawAll();
      this._checkWin();

    // ---- swordsman: atacar → mover ----
    } else if (ts.phase === 'sw_attack') {
      const atk = this._findUnit('swordsman', p, 'attack', coord);
      if (!atk) return;
      this.isAnimating = true;
      await this._animateAttack(atk.position, coord, 'swordsman');
      this._applyAttackDamage(atk, coord);
      atk.hasActed = true;
      this._markUsed(ts.coinId);
      this.isAnimating = false;
      this.drawAll();
      this._checkWin();

      const moveTargets = this._getEmptyNeighbors(atk.position);
      if (moveTargets.length === 0) {
        this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
        this._clearSel();
        this._emitUI('Espadachín atacó. Sin hexes para moverse.');
        return;
      }
      this.tacticStep = { ...ts, phase: 'sw_move', unitPos: atk.position };
      this.state.validTargets = moveTargets;
      this._emitUI('Espadachín: ahora movete 1 hex.', 'unit', 'swordsman');
      this.drawAll();

    } else if (ts.phase === 'sw_move') {
      const unit = ts.unitPos ? this._unitAt(ts.unitPos, p, 'swordsman') : null;
      if (unit) {
        this.isAnimating = true;
        await this._animateMove(unit.position, coord);
        this._doStateMove(unit, coord);
        this.isAnimating = false;
      }
      this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
      this._clearSel();
      this.drawAll();
      this._checkWin();

    // ---- cavalry: mover 1 hex → atacar ----
    } else if (ts.phase === 'cavalry_move') {
      const unit = this._findUnit('cavalry', p, 'move', coord);
      if (!unit) return;
      this.isAnimating = true;
      await this._animateMove(unit.position, coord);
      this._doStateMove(unit, coord);
      this.isAnimating = false;
      this.drawAll();
      this._checkWin();

      const atkTargets = this._targetsAdjacentEnemies(coord, p);
      if (atkTargets.length === 0) {
        this._markUsed(ts.coinId);
        this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
        this._clearSel();
        this._emitUI('Caballería se movió (sin enemigos adyacentes para atacar).');
        return;
      }
      this.tacticStep = { ...ts, phase: 'cavalry_attack', unitPos: coord };
      this.state.validTargets = atkTargets;
      this._emitUI('Caballería (2/2): ¿a qué enemigo atacás?', 'unit', 'cavalry');
      this.drawAll();

    } else if (ts.phase === 'cavalry_attack') {
      const atk = ts.unitPos ? this._unitAt(ts.unitPos, p, 'cavalry') : null;
      if (!atk) { this._markUsed(ts.coinId); this._clearTacticState(); return; }
      this.isAnimating = true;
      await this._animateAttack(atk.position, coord, 'cavalry');
      this._applyAttackDamage(atk, coord);
      this._markUsed(ts.coinId);
      this.isAnimating = false;
      this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
      this._clearSel();
      this.drawAll();
      this._checkWin();

    // ---- lancer: cargar en línea recta → atacar ----
    } else if (ts.phase === 'lancer_move') {
      const unit = this._findUnit('lancer', p, 'move', coord);
      if (!unit) return;
      this.isAnimating = true;
      await this._animateMove(unit.position, coord);
      this._doStateMove(unit, coord);
      this.isAnimating = false;
      this.drawAll();
      this._checkWin();

      const atkTargets = this._targetsAdjacentEnemies(coord, p);
      if (atkTargets.length === 0) {
        this._markUsed(ts.coinId);
        this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
        this._clearSel();
        this._emitUI('Lancero cargó (sin enemigos adyacentes para atacar).');
        return;
      }
      this.tacticStep = { ...ts, phase: 'lancer_attack', unitPos: coord };
      this.state.validTargets = atkTargets;
      this._emitUI('Lancero (2/2): ¿a qué enemigo atacás?', 'unit', 'lancer');
      this.drawAll();

    } else if (ts.phase === 'lancer_attack') {
      const atk = ts.unitPos ? this._unitAt(ts.unitPos, p, 'lancer') : null;
      if (!atk) { this._markUsed(ts.coinId); this._clearTacticState(); return; }
      this.isAnimating = true;
      await this._animateAttack(atk.position, coord, 'lancer');
      this._applyAttackDamage(atk, coord);
      this._markUsed(ts.coinId);
      this.isAnimating = false;
      this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
      this._clearSel();
      this.drawAll();
      this._checkWin();

    // ---- footman: mover 2 peones (paso 1) ----
    } else if (ts.phase === 'footman_move1') {
      const unit = ts.unitPos ? this._unitAt(ts.unitPos, p, 'footman') : null;
      if (!unit) { this._markUsed(ts.coinId); this._clearTacticState(); return; }
      this.isAnimating = true;
      await this._animateMove(unit.position, coord);
      this._doStateMove(unit, coord);
      this.isAnimating = false;
      this.drawAll();
      this._checkWin();

      // Buscar segundo peón (distinto al que acaba de moverse)
      let otherPos: HexCoord | null = null;
      this.state.tiles.forEach((t) => {
        if (t.unit?.owner === p && t.unit.type === 'footman' && !(t.coord.q === coord.q && t.coord.r === coord.r)) {
          otherPos = t.coord;
        }
      });

      if (!otherPos) {
        this._markUsed(ts.coinId);
        this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
        this._clearSel();
        this._emitUI('Peón se movió.');
        return;
      }
      const move2Targets = this._targetsMoveFromPos(otherPos, 1);
      if (move2Targets.length === 0) {
        this._markUsed(ts.coinId);
        this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
        this._clearSel();
        this._emitUI('Peón 1 se movió. Peón 2 no tiene hexes libres.');
        return;
      }
      this.tacticStep = { ...ts, phase: 'footman_move2', unitPos: otherPos };
      this.state.validTargets = move2Targets;
      this._emitUI('Peón (2/2): ¿a dónde se mueve el segundo?', 'unit', 'footman');
      this.drawAll();

    // ---- footman: mover 2 peones (paso 2) ----
    } else if (ts.phase === 'footman_move2') {
      const unit = ts.unitPos ? this._unitAt(ts.unitPos, p, 'footman') : null;
      if (unit) {
        this.isAnimating = true;
        await this._animateMove(unit.position, coord);
        this._doStateMove(unit, coord);
        this.isAnimating = false;
      }
      this._markUsed(ts.coinId);
      this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
      this._clearSel();
      this.drawAll();
      this._checkWin();

    // ---- marshal: seleccionar aliado → atacar ----
    } else if (ts.phase === 'marshal_select') {
      // coord = posición del aliado elegido
      const ally = this._unitAt(coord, p);
      if (!ally) { this._emitUI('No hay aliado en ese hex.'); return; }
      const atkTargets = this._targetsAdjacentEnemies(coord, p);
      if (atkTargets.length === 0) { this._emitUI('Ese aliado no tiene enemigos adyacentes.'); return; }
      this.tacticStep = { ...ts, phase: 'marshal_attack', unitPos: coord };
      this.state.validTargets = atkTargets;
      this._emitUI(`Mariscal: ${ally.type} atacará. ¿A qué enemigo?`, 'unit', 'marshal');
      this.drawAll();

    } else if (ts.phase === 'marshal_attack') {
      const ally = ts.unitPos ? this._unitAt(ts.unitPos, p) : null;
      if (!ally) { this._markUsed(ts.coinId); this._clearTacticState(); return; }
      this.isAnimating = true;
      await this._animateAttack(ally.position, coord, ally.type);
      this._applyAttackDamage(ally, coord);
      this._markUsed(ts.coinId);
      this.isAnimating = false;
      this.tacticStep = null; this.state.pendingAction = null; this.state.validTargets = [];
      this._clearSel();
      this.drawAll();
      this._checkWin();
    }
  }

  // Limpia el estado de táctica (helper para cancelar)
  private _clearTacticState(): void {
    this.tacticStep = null;
    this.state.pendingAction = null;
    this.state.validTargets = [];
    this._clearSel();
  }

  // ==========================================================
  // TARGETS VÁLIDOS
  // ==========================================================

  private _targetsMove(type: UnitType, p: PlayerIndex): HexCoord[] {
    return this._targetsMoveLong(type, p, UNIT_STATS[type].moveRange);
  }

  private _targetsMoveLong(type: UnitType, p: PlayerIndex, range: number): HexCoord[] {
    const seen = new Set<string>(); const res: HexCoord[] = [];
    this.state.tiles.forEach((t) => {
      if (!t.unit || t.unit.owner !== p || t.unit.type !== type) return;
      // Knight pasiva: unidades adyacentes a un Caballero enemigo no pueden moverse
      if (this._isKnightPinned(t.unit, p)) return;
      // BFS para movimiento con range > 1 (pathfinding básico)
      if (range === 1) {
        hexNeighbors(t.unit.position).forEach((n) => {
          const k = coordKey(n);
          if (!seen.has(k) && isOnBoard(n) && !this.state.tiles.get(k)?.unit) {
            seen.add(k); res.push(n);
          }
        });
      } else {
        hexesInRange(t.unit.position, range).forEach((c) => {
          const k = coordKey(c);
          if (!seen.has(k) && isOnBoard(c) && !this.state.tiles.get(k)?.unit) {
            seen.add(k); res.push(c);
          }
        });
      }
    });
    return res;
  }

  private _targetsAttack(type: UnitType, p: PlayerIndex): HexCoord[] {
    if (UNIT_STATS[type].attackRange === 0) return [];
    const range = UNIT_STATS[type].attackRange;
    const seen = new Set<string>(); const res: HexCoord[] = [];
    this.state.tiles.forEach((t) => {
      if (!t.unit || t.unit.owner !== p || t.unit.type !== type) return;
      hexesInRange(t.unit.position, range).forEach((c) => {
        const k = coordKey(c);
        if (seen.has(k) || !isOnBoard(c)) return;
        const tt = this.state.tiles.get(k);
        if (tt?.unit && tt.unit.owner !== p) { seen.add(k); res.push(c); }
      });
    });
    return res;
  }

  private _targetsArcherTactic(p: PlayerIndex): HexCoord[] {
    const seen = new Set<string>(); const res: HexCoord[] = [];
    this.state.tiles.forEach((t) => {
      if (!t.unit || t.unit.owner !== p || t.unit.type !== 'archer') return;
      hexesInRange(t.unit.position, 2).forEach((c) => {
        if (hexDistance(t.unit!.position, c) !== 2) return;
        const k = coordKey(c);
        if (seen.has(k) || !isOnBoard(c)) return;
        const tt = this.state.tiles.get(k);
        if (tt?.unit && tt.unit.owner !== p) { seen.add(k); res.push(c); }
      });
    });
    return res;
  }

  private _targetsDeploy(type: UnitType, p: PlayerIndex): HexCoord[] {
    const stats = UNIT_STATS[type];
    let count = 0;
    this.state.tiles.forEach((t) => { if (t.unit?.owner === p && t.unit.type === type) count++; });
    if (count >= (stats.canHaveMultiple ? 2 : 1)) return [];

    const seen = new Set<string>(); const res: HexCoord[] = [];
    if (stats.flexibleDeploy) {
      this.state.tiles.forEach((t) => {
        if (!t.unit || t.unit.owner !== p) return;
        hexNeighbors(t.coord).forEach((n) => {
          const k = coordKey(n);
          if (!seen.has(k) && isOnBoard(n) && !this.state.tiles.get(k)?.unit) { seen.add(k); res.push(n); }
        });
      });
    } else {
      this.state.tiles.forEach((t) => {
        if (t.tileType === 'controlLocation' && t.controlledBy === p && !t.unit) {
          const k = coordKey(t.coord);
          if (!seen.has(k)) { seen.add(k); res.push(t.coord); }
        }
      });
    }
    return res;
  }

  private _targetsBolster(type: UnitType, p: PlayerIndex): HexCoord[] {
    const res: HexCoord[] = [];
    this.state.tiles.forEach((t) => {
      if (t.unit?.owner === p && t.unit.type === type) res.push(t.coord);
    });
    return res;
  }

  private _targetsControl(p: PlayerIndex): HexCoord[] {
    const res: HexCoord[] = [];
    this.state.tiles.forEach((t) => {
      if (t.tileType === 'controlLocation' && t.unit?.owner === p && t.controlledBy !== p) {
        res.push(t.coord);
      }
    });
    return res;
  }

  // Enemigos adyacentes a un hex (para cavalry/lancer/marshal)
  private _targetsAdjacentEnemies(pos: HexCoord, p: PlayerIndex): HexCoord[] {
    return hexNeighbors(pos).filter((n) => {
      if (!isOnBoard(n)) return false;
      const t = this.state.tiles.get(coordKey(n));
      return t?.unit && t.unit.owner !== p;
    });
  }

  // Movimiento desde una posición específica (para footman tactic)
  private _targetsMoveFromPos(pos: HexCoord, range: number): HexCoord[] {
    const res: HexCoord[] = [];
    if (range === 1) {
      hexNeighbors(pos).forEach((n) => {
        if (isOnBoard(n) && !this.state.tiles.get(coordKey(n))?.unit) res.push(n);
      });
    } else {
      hexesInRange(pos, range).forEach((c) => {
        if (isOnBoard(c) && !this.state.tiles.get(coordKey(c))?.unit) res.push(c);
      });
    }
    return res;
  }

  // Lancer: hexes en línea recta 1-2 pasos sin obstáculo
  private _targetsLancerMove(p: PlayerIndex): HexCoord[] {
    const res: HexCoord[] = [];
    const seen = new Set<string>();
    this.state.tiles.forEach((t) => {
      if (!t.unit || t.unit.owner !== p || t.unit.type !== 'lancer') return;
      const pos = t.unit.position;
      for (const dir of HEX_DIRECTIONS) {
        for (let step = 1; step <= 2; step++) {
          const c = { q: pos.q + dir.q * step, r: pos.r + dir.r * step };
          if (!isOnBoard(c)) break;
          if (this.state.tiles.get(coordKey(c))?.unit) break; // bloqueado
          const k = coordKey(c);
          if (!seen.has(k)) { seen.add(k); res.push(c); }
        }
      }
    });
    return res;
  }

  // Crossbowman: enemigos a exactamente 2 hexes en línea recta sin obstáculo
  private _targetsCrossbowmanTactic(p: PlayerIndex): HexCoord[] {
    const res: HexCoord[] = [];
    const seen = new Set<string>();
    this.state.tiles.forEach((t) => {
      if (!t.unit || t.unit.owner !== p || t.unit.type !== 'crossbowman') return;
      const pos = t.unit.position;
      for (const dir of HEX_DIRECTIONS) {
        const c1 = { q: pos.q + dir.q,     r: pos.r + dir.r };
        const c2 = { q: pos.q + dir.q * 2, r: pos.r + dir.r * 2 };
        if (!isOnBoard(c2)) continue;
        if (this.state.tiles.get(coordKey(c1))?.unit) continue; // bloqueado en c1
        const target = this.state.tiles.get(coordKey(c2));
        if (target?.unit && target.unit.owner !== p) {
          const k = coordKey(c2);
          if (!seen.has(k)) { seen.add(k); res.push(c2); }
        }
      }
    });
    return res;
  }

  // Marshal: aliados (no archer/lancer) que tengan al menos 1 enemigo adyacente
  private _targetsMarshalAllySelect(p: PlayerIndex): HexCoord[] {
    const res: HexCoord[] = [];
    this.state.tiles.forEach((t) => {
      if (!t.unit || t.unit.owner !== p) return;
      const ut = t.unit.type;
      if (ut === 'archer' || ut === 'lancer' || ut === 'marshal') return;
      const hasEnemy = hexNeighbors(t.coord).some((n) => {
        const nt = this.state.tiles.get(coordKey(n));
        return nt?.unit && nt.unit.owner !== p;
      });
      if (hasEnemy) res.push(t.coord);
    });
    return res;
  }

  // Knight pasiva: ¿está esta unidad adyacente a un Caballero enemigo?
  private _isKnightPinned(unit: Unit, p: PlayerIndex): boolean {
    const enemy: PlayerIndex = p === 0 ? 1 : 0;
    return hexNeighbors(unit.position).some((n) => {
      const t = this.state.tiles.get(coordKey(n));
      return t?.unit?.owner === enemy && t.unit.type === 'knight';
    });
  }

  // ==========================================================
  // EJECUCIÓN DE ACCIONES
  // ==========================================================

  private async _executeMove(unit: Unit, to: HexCoord, coinId: string): Promise<void> {
    this.isAnimating = true;
    this._markUsed(coinId);
    await this._animateMove(unit.position, to);
    this._doStateMove(unit, to);
    this.isAnimating = false;
    this._clearSel();
    this.drawAll();
    this._checkWin();
  }

  private _doStateMove(unit: Unit, to: HexCoord): void {
    const fromTile = this.state.tiles.get(coordKey(unit.position))!;
    const toTile   = this.state.tiles.get(coordKey(to))!;
    fromTile.unit = null;
    unit.position = { ...to };
    unit.hasMoved = true;
    toTile.unit   = unit;
    // Neutralizar bandera enemiga al ocupar esa posición
    if (toTile.tileType === 'controlLocation' && toTile.controlledBy !== null && toTile.controlledBy !== unit.owner) {
      this.state.controlMarkersOnBoard[toTile.controlledBy]--;
      toTile.controlledBy = null;
    }
  }

  private async _executeAttack(atk: Unit, targetCoord: HexCoord, coinId: string): Promise<void> {
    const defTile = this.state.tiles.get(coordKey(targetCoord));
    if (!defTile?.unit) return;

    this.isAnimating = true;
    this._markUsed(coinId);
    atk.hasActed = true;

    await this._animateAttack(atk.position, targetCoord, atk.type);
    this._applyAttackDamage(atk, targetCoord);

    this.isAnimating = false;
    this._clearSel();
    this.drawAll();
    this._checkWin();
  }

  private _applyAttackDamage(atk: Unit, targetCoord: HexCoord): void {
    const defTile = this.state.tiles.get(coordKey(targetCoord));
    const def = defTile?.unit;
    if (!def) return;

    const isPikemanCounterattack = def.type === 'pikeman' && hexDistance(atk.position, targetCoord) === 1;

    // Quitar 1 moneda del defensor (permanente)
    this._removeTopCoin(def, targetCoord);

    // Pikeman contraataca en cuerpo a cuerpo
    if (isPikemanCounterattack && atk.stack > 0) {
      this._removeTopCoin(atk, atk.position);
    }
  }

  private _removeTopCoin(unit: Unit, atCoord: HexCoord): void {
    if (unit.stack <= 0) return;
    unit.stack--;
    unit.coins.pop();
    this.state.coinsDestroyed[unit.owner]++;
    if (unit.stack <= 0) {
      const tile = this.state.tiles.get(coordKey(atCoord));
      if (tile) tile.unit = null;
    }
  }

  private async _executeDeploy(p: PlayerIndex, coin: Coin, coord: HexCoord): Promise<void> {
    const tile = this.state.tiles.get(coordKey(coord));
    if (!tile || tile.unit) return;
    this.isAnimating = true;
    this._markUsed(coin.id);
    const physCoin = this.bag.removeFromHand(p, coin.id) ?? coin;
    this._syncBag();
    tile.unit = mkUnit(coin.unitType!, p, coord);
    tile.unit.coins = [physCoin];
    await this._animateSpawn(coord);
    this.isAnimating = false;
    this._clearSel();
    this.drawAll();
    this._emitUI(`${UNIT_STATS[coin.unitType!].name} desplegado.`);
    this._checkWin();
  }

  private async _executeBolster(p: PlayerIndex, coin: Coin, targetUnit: Unit): Promise<void> {
    this.isAnimating = true;
    this._markUsed(coin.id);
    const physCoin = this.bag.removeFromHand(p, coin.id) ?? coin;
    this._syncBag();
    targetUnit.stack++;
    targetUnit.coins.push(physCoin);
    await this._animateBolster(targetUnit.position);
    this.isAnimating = false;
    this._clearSel();
    this.drawAll();
    this._emitUI(`${UNIT_STATS[targetUnit.type].name} reforzado (stack: ${targetUnit.stack}).`);
  }

  private async _executeControl(p: PlayerIndex, coord: HexCoord, coinId: string): Promise<void> {
    const tile = this.state.tiles.get(coordKey(coord));
    if (!tile) return;
    this.isAnimating = true;
    this._markUsed(coinId);
    if (tile.controlledBy !== null && tile.controlledBy !== p) {
      this.state.controlMarkersOnBoard[tile.controlledBy]--;
    }
    await this._animateMarker(coord, p);
    tile.controlledBy = p;
    this.state.controlMarkersOnBoard[p]++;
    this.isAnimating = false;
    this._clearSel();
    this.drawAll();
    this._emitUI(`✦ Marcador colocado. ${PLAYER_NAMES[p]}: ${this.state.controlMarkersOnBoard[p]}/${CONTROL_POINTS_TO_WIN}`);
    this._checkWin();
  }

  private async _executeRecruit(p: PlayerIndex, coin: Coin): Promise<void> {
    this.isAnimating = true;
    const type = coin.unitType!;
    const added = this.bag.recruit(p, type);
    this.bag.addToDiscard(p, coin);
    this.bag.removeFromHand(p, coin.id);
    this._syncBag();
    this._markUsed(coin.id);
    this.isAnimating = false;
    this._clearSel();
    this.drawAll();
    this._emitUI(`Reclutado: +${added} ${UNIT_STATS[type].name} al descarte.`);
  }

  private _useDiscard(p: PlayerIndex, coin: Coin, coinId: string): void {
    this.bag.addToDiscard(p, coin);
    this.bag.removeFromHand(p, coinId);
    this._syncBag();
    this._markUsed(coinId);
    this._clearSel();
    this.drawAll();
  }

  // ==========================================================
  // HELPERS
  // ==========================================================

  private _findUnit(
    type: UnitType, p: PlayerIndex,
    mode: 'move' | 'attack' | 'move2',
    target: HexCoord
  ): Unit | null {
    let best: Unit | null = null, bestDist = 999;
    const range = mode === 'move2' ? 2 : UNIT_STATS[type][mode === 'move' ? 'moveRange' : 'attackRange'];
    this.state.tiles.forEach((tile) => {
      const u = tile.unit;
      if (!u || u.owner !== p || u.type !== type) return;
      const d = hexDistance(u.position, target);
      if (mode === 'move' || mode === 'move2') {
        if (d > 0 && d <= range && d < bestDist) { best = u; bestDist = d; }
      } else {
        if (d <= range && d < bestDist) { best = u; bestDist = d; }
      }
    });
    return best;
  }

  private _unitAt(coord: HexCoord, p: PlayerIndex, type?: UnitType): Unit | null {
    const t = this.state.tiles.get(coordKey(coord));
    if (!t?.unit || t.unit.owner !== p) return null;
    if (type && t.unit.type !== type) return null;
    return t.unit;
  }

  private _getEmptyNeighbors(pos: HexCoord): HexCoord[] {
    return hexNeighbors(pos).filter((n) => isOnBoard(n) && !this.state.tiles.get(coordKey(n))?.unit);
  }

  private _markUsed(coinId: string): void { this.state.usedCoinIds.add(coinId); }

  private _clearSel(): void {
    this.state.selectedCoinId = null;
    this.state.pendingAction  = null;
    this.state.validTargets   = [];
    if (!this.tacticStep && !this.recruitWait) this._emitUI('');
    this.drawAll();
  }

  private _checkWin(): void {
    for (let p = 0; p < 2; p++) {
      if (this.state.controlMarkersOnBoard[p] >= CONTROL_POINTS_TO_WIN) {
        this.state.winner   = p as PlayerIndex;
        this.state.phase    = 'gameover';
        this.state.winReason = `${PLAYER_NAMES[p as PlayerIndex]} controló ${CONTROL_POINTS_TO_WIN} puntos`;
        this.drawAll();
        this._emitUI(`🏆 ${PLAYER_NAMES[p as PlayerIndex]} gana!`);
      }
    }
  }

  private _restartGame(): void {
    unitIdCounter = 0;
    this.inDraft = true;
    this._startDraft();
  }

  // ==========================================================
  // EMIT UI
  // ==========================================================

  private _emitUI(
    message: string,
    selectedCoinKind?: CoinKind,
    selectedUnitType?: UnitType,
    draft?: DraftState,
  ): void {
    const base: UIState = {
      phase: this.inDraft ? 'draft' : this.state.phase,
      round:  this.inDraft ? 1 : this.state.round,
      currentPlayer:    this.inDraft ? 0 : this.state.currentPlayer,
      initiativeHolder: this.inDraft ? 0 : this.state.initiativeHolder,
      hands:       this.inDraft ? [[], []] : [
        (this.bag?.hands[0] ?? []).map((c) => ({ ...c })),
        (this.bag?.hands[1] ?? []).map((c) => ({ ...c })),
      ],
      bagSizes:     [this.bag?.getBagSize(0) ?? 0, this.bag?.getBagSize(1) ?? 0],
      discardSizes: [this.bag?.getDiscardSize(0) ?? 0, this.bag?.getDiscardSize(1) ?? 0],
      coinSupply:   this.inDraft
        ? [{} as any, {} as any]
        : this.bag.coinSupply.map((s) => ({ ...s })),
      controlMarkersOnBoard: this.inDraft ? [0, 0] : [...this.state.controlMarkersOnBoard],
      coinsDestroyed:        this.inDraft ? [0, 0] : [...this.state.coinsDestroyed],
      selectedCoinId:  this.inDraft ? null : this.state.selectedCoinId,
      pendingAction:   this.inDraft ? null : this.state.pendingAction,
      usedCoinIds:     this.inDraft ? [] : Array.from(this.state.usedCoinIds),
      winner:          this.inDraft ? null : this.state.winner,
      winReason:       this.inDraft ? '' : this.state.winReason,
      message,
      selectedCoinKind,
      selectedUnitType,
      draft: draft ?? (this.inDraft ? this.draft : undefined),
    };
    GameBridge.emit('uiUpdate', base);
  }

  // ==========================================================
  // ANIMACIONES
  // ==========================================================

  private _animateDraw(player: PlayerIndex, onDone: () => void): void {
    const count = this.bag.hands[player].length;
    if (count === 0) { onDone(); return; }
    const color = PLAYER_COLORS[player];
    let done = 0;
    const bagX = 80, bagY = 120;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const g = this.add.graphics();
      g.fillStyle(color, 0.9); g.fillCircle(0, 0, 9);
      g.lineStyle(2, 0xffd700, 0.8); g.strokeCircle(0, 0, 9);
      g.x = bagX; g.y = bagY;
      this.time.delayedCall(i * 90, () => {
        this.tweens.add({
          targets: g,
          x: bagX + Math.cos(angle) * 55,
          y: bagY + Math.sin(angle) * 55,
          alpha: 0, duration: 420, ease: 'Cubic.easeOut',
          onComplete: () => { g.destroy(); if (++done === count) onDone(); },
        });
      });
    }
    const bag = this.add.graphics();
    bag.fillStyle(0x5a3a10, 0.8); bag.fillEllipse(bagX, bagY, 40, 50);
    this.tweens.add({ targets: bag, scaleX: 1.15, scaleY: 0.88, duration: 110, yoyo: true, repeat: 2, onComplete: () => bag.destroy() });
  }

  private _animateMove(from: HexCoord, to: HexCoord): Promise<void> {
    return new Promise((resolve) => {
      const fp = hexToPixel(from.q, from.r), tp = hexToPixel(to.q, to.r);
      const g = this.add.graphics();
      g.fillStyle(0xffd700, 0.35); g.fillCircle(0, 0, HEX_SIZE * 0.5);
      g.x = fp.x + this.cx; g.y = fp.y + this.cy;
      this.tweens.add({
        targets: g, x: tp.x + this.cx, y: tp.y + this.cy,
        duration: 260, ease: 'Sine.easeInOut',
        onComplete: () => { g.destroy(); resolve(); },
      });
    });
  }

  private _animateAttack(from: HexCoord, to: HexCoord, type: UnitType, forceRanged = false): Promise<void> {
    return new Promise((resolve) => {
      const fp = hexToPixel(from.q, from.r), tp = hexToPixel(to.q, to.r);
      const fx = fp.x + this.cx, fy = fp.y + this.cy;
      const tx = tp.x + this.cx, ty = tp.y + this.cy;
      if (type === 'archer') {
        this._animArrow(fx, fy, tx, ty, resolve, 0x22cc88);
      } else if (forceRanged) {
        this._animArrow(fx, fy, tx, ty, resolve, 0x8899cc);
      } else {
        this._animMelee(tx, ty, resolve);
      }
    });
  }

  // Tácticas de 1 paso: archer tira a dist 2 (puede atravesar), crossbowman en línea recta
  private async _executeSingleStepTactic(type: UnitType, p: PlayerIndex, coin: Coin, coord: HexCoord): Promise<void> {
    let atk: Unit | null = null;
    let bestDist = 999;
    this.state.tiles.forEach((tile) => {
      const u = tile.unit;
      if (!u || u.owner !== p || u.type !== type) return;
      const d = hexDistance(u.position, coord);
      if (d > 0 && d < bestDist) { atk = u; bestDist = d; }
    });
    if (!atk) return;

    const isRanged = type === 'archer' || type === 'crossbowman';
    this.isAnimating = true;
    this._markUsed(coin.id);
    await this._animateAttack((atk as Unit).position, coord, type, isRanged);
    this._applyAttackDamage(atk as Unit, coord);
    this.isAnimating = false;
    this._clearSel();
    this.drawAll();
    this._checkWin();
  }

  private _animArrow(fx: number, fy: number, tx: number, ty: number, done: () => void, col = 0xffcc44): void {
    const g = this.add.graphics();
    g.fillStyle(col, 1); g.fillRect(-12, -3, 24, 6);
    g.setRotation(Math.atan2(ty - fy, tx - fx));
    g.x = fx; g.y = fy;
    this.tweens.add({
      targets: g, x: tx, y: ty, duration: 230, ease: 'Linear',
      onComplete: () => {
        const f = this.add.graphics();
        f.fillStyle(0xffcc00, 0.85); f.fillCircle(tx, ty, 18);
        this.tweens.add({ targets: f, alpha: 0, scaleX: 2.2, scaleY: 2.2, duration: 200, onComplete: () => { f.destroy(); done(); } });
        g.destroy();
      },
    });
  }

  private _animMelee(tx: number, ty: number, done: () => void): void {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const sp = this.add.graphics();
      sp.fillStyle(0xffffff, 1); sp.fillCircle(0, 0, 4); sp.x = tx; sp.y = ty;
      this.tweens.add({ targets: sp, x: tx + Math.cos(a) * 28, y: ty + Math.sin(a) * 28, alpha: 0, duration: 280, onComplete: () => sp.destroy() });
    }
    const f = this.add.graphics();
    f.fillStyle(0xff3300, 0.6); f.fillCircle(tx, ty, 22);
    this.tweens.add({ targets: f, alpha: 0, duration: 250, onComplete: () => { f.destroy(); done(); } });
    this.cameras.main.shake(90, 0.004);
  }

  private _animateSpawn(coord: HexCoord): Promise<void> {
    return new Promise((resolve) => {
      const px = hexToPixel(coord.q, coord.r);
      const cx = px.x + this.cx, cy = px.y + this.cy;
      const ring = this.add.graphics();
      ring.lineStyle(4, 0xffd700, 0.9); ring.strokeCircle(cx, cy, 10);
      this.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 340, onComplete: () => { ring.destroy(); resolve(); } });
    });
  }

  private _animateBolster(coord: HexCoord): Promise<void> {
    return new Promise((resolve) => {
      const px = hexToPixel(coord.q, coord.r);
      const cx = px.x + this.cx, cy = px.y + this.cy;
      const g = this.add.graphics();
      g.fillStyle(0xffd700, 0.9); g.fillCircle(0, 0, 8);
      g.x = cx; g.y = cy - 36;
      this.tweens.add({ targets: g, y: cy, alpha: 0.5, duration: 280, ease: 'Bounce.easeOut', onComplete: () => { g.destroy(); resolve(); } });
    });
  }

  private _animateMarker(coord: HexCoord, p: PlayerIndex): Promise<void> {
    return new Promise((resolve) => {
      const px = hexToPixel(coord.q, coord.r);
      const cx = px.x + this.cx, cy = px.y + this.cy;
      const col = PLAYER_COLORS[p];
      const f = this.add.graphics();
      f.fillStyle(col, 0.9); f.fillRect(-5, 0, 10, 15);
      f.x = cx; f.y = cy - 26;
      this.tweens.add({
        targets: f, y: cy - 40, duration: 150, ease: 'Bounce.easeOut',
        onComplete: () => {
          const pulse = this.add.graphics();
          pulse.fillStyle(col, 0.4); pulse.fillCircle(cx, cy, 14);
          this.tweens.add({ targets: pulse, scaleX: 3, scaleY: 3, alpha: 0, duration: 380, onComplete: () => { pulse.destroy(); f.destroy(); resolve(); } });
        },
      });
    });
  }

  // ==========================================================
  // RENDERIZADO
  // ==========================================================

  drawAll(): void {
    this.gBoard.clear();
    this.gUnits.clear();
    this.gFx.clear();
    this.unitLabels.forEach((t) => t.destroy());
    this.unitLabels.clear();

    this._drawBoard();
    if (!this.inDraft) this._drawUnits();
    this._drawInfoBar();
  }

  private _drawBoard(): void {
    if (!this.state?.tiles) return;
    this.state.tiles.forEach((tile) => this._drawHex(tile));
  }

  private _drawHex(tile: HexTile): void {
    const px = hexToPixel(tile.coord.q, tile.coord.r);
    const cx = px.x + this.cx, cy = px.y + this.cy;
    const corners = hexCorners(cx, cy, HEX_SIZE - 1.5);
    const isCtrl   = tile.tileType === 'controlLocation';
    const isTarget = !this.inDraft && this.state.validTargets.some(
      (t) => t.q === tile.coord.q && t.r === tile.coord.r
    );

    // ---- 1. Fill base (crema cálida) ----
    this.gBoard.fillStyle(isCtrl ? C.HEX_CONTROL : C.HEX_NORMAL, 1);
    this.gBoard.fillPoints(corners, true);

    // ---- 2. Overlay de acción (translúcido sobre el crema) ----
    if (isTarget) {
      const pa = this.state.pendingAction;
      let ovl = C.OVL_MOVE;
      if (pa === 'attack')  ovl = C.OVL_ATTACK;
      if (pa === 'deploy')  ovl = C.OVL_DEPLOY;
      if (pa === 'bolster') ovl = C.OVL_BOLSTER;
      if (pa === 'control') ovl = C.OVL_CTRL;
      this.gBoard.fillStyle(ovl, 0.38);
      this.gBoard.fillPoints(corners, true);
    }

    // ---- 3. Borde ----
    let stroke = C.HEX_BORDER, sw = 1.2;
    if (isCtrl) {
      stroke = tile.controlledBy === 0 ? PLAYER_COLORS[0]
             : tile.controlledBy === 1 ? PLAYER_COLORS[1] : C.HEX_CTRL_BORDER;
      sw = 2.5;
    }
    if (isTarget) {
      const pa = this.state.pendingAction;
      if (pa === 'move'   || pa === 'tactic') stroke = 0x22cc44;
      if (pa === 'attack')  stroke = 0xee2211;
      if (pa === 'deploy')  stroke = 0x2277ff;
      if (pa === 'bolster') stroke = 0xff8811;
      if (pa === 'control') stroke = 0xffcc00;
      sw = 2.8;
    }
    this.gBoard.lineStyle(sw, stroke, 1);
    this.gBoard.strokePoints(corners, true);

    // ---- 4. Mandala decorativo en puntos de control ----
    if (isCtrl) this._drawControlMandala(cx, cy, tile.controlledBy);
  }

  // Mandala inspirado en el diseño del tablero real de War Chest
  private _drawControlMandala(cx: number, cy: number, controlledBy: PlayerIndex | null): void {
    const mc    = controlledBy === 0 ? PLAYER_COLORS[0]
                : controlledBy === 1 ? PLAYER_COLORS[1] : 0x997722;
    const alpha = controlledBy !== null ? 0.85 : 0.50;

    // Punto central
    this.gBoard.fillStyle(mc, alpha);
    this.gBoard.fillCircle(cx, cy, HEX_SIZE * 0.09);

    // Anillo interior
    this.gBoard.lineStyle(2, mc, alpha * 0.95);
    this.gBoard.strokeCircle(cx, cy, HEX_SIZE * 0.22);

    // Anillo medio
    this.gBoard.lineStyle(1.5, mc, alpha * 0.65);
    this.gBoard.strokeCircle(cx, cy, HEX_SIZE * 0.38);

    // Anillo exterior
    this.gBoard.lineStyle(1, mc, alpha * 0.38);
    this.gBoard.strokeCircle(cx, cy, HEX_SIZE * 0.52);
  }

  private _drawUnits(): void {
    if (!this.state?.tiles) return;
    this.state.tiles.forEach((tile) => {
      if (!tile.unit) return;
      const px = hexToPixel(tile.coord.q, tile.coord.r);
      this._drawUnit(px.x + this.cx, px.y + this.cy, tile.unit);
    });
  }

  private _drawUnit(cx: number, cy: number, unit: Unit): void {
    const stat   = UNIT_STATS[unit.type];
    const pColor = PLAYER_COLORS[unit.owner];
    const r      = HEX_SIZE * 0.44;

    // Capas del stack — cada una ligeramente hacia arriba (profundidad de monedas)
    for (let i = unit.stack - 1; i >= 0; i--) {
      const off = i * 3;
      // Sombra de esa capa
      this.gUnits.fillStyle(0x000000, 0.22);
      this.gUnits.fillCircle(cx + 2, cy - off + 2, r);
      // Cuerpo de la moneda
      this.gUnits.fillStyle(pColor, 1);
      this.gUnits.fillCircle(cx, cy - off, r);
      // Brillo interior (highlight)
      this.gUnits.fillStyle(0xffffff, 0.18);
      this.gUnits.fillCircle(cx - r * 0.25, cy - off - r * 0.25, r * 0.45);
    }

    // Borde brillante si la moneda de esa unidad está seleccionada en mano
    const sel = this.state.selectedCoinId &&
      this.state.hands[unit.owner].find(
        (c) => c.id === this.state.selectedCoinId && c.unitType === unit.type
      );
    if (sel) {
      this.gUnits.lineStyle(3.5, 0xffe066, 1);
      this.gUnits.strokeCircle(cx, cy, r + 4);
    }

    // Disco interno con color de tipo (identifica la unidad)
    this.gUnits.fillStyle(stat.color, 0.80);
    this.gUnits.fillCircle(cx, cy, r * 0.52);
    // Borde sutil del disco
    this.gUnits.lineStyle(1, 0xffffff, 0.22);
    this.gUnits.strokeCircle(cx, cy, r * 0.52);

    // Etiqueta abreviada
    const textColor = unit.owner === 0 ? '#1a0a00' : '#ffffff';
    const lbl = this.add.text(cx, cy - 1, stat.shortName, {
      fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'bold',
      color: textColor, stroke: '#000000', strokeThickness: 2.5,
    }).setOrigin(0.5, 0.5).setDepth(10);
    this.unitLabels.set(unit.id, lbl);

    // Badge de stack si > 1 (esquina superior derecha)
    if (unit.stack > 1) {
      this.gUnits.fillStyle(0x111111, 0.75);
      this.gUnits.fillCircle(cx + r * 0.65, cy - r * 0.65, 8);
      const sl = this.add.text(cx + r * 0.65, cy - r * 0.65, `${unit.stack}`, {
        fontFamily: 'Georgia, serif', fontSize: '9px', fontStyle: 'bold',
        color: '#ffd700', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(11);
      this.unitLabels.set(`${unit.id}_s`, sl);
    }
  }

  private _drawInfoBar(): void {
    if (this.inDraft) return;
    const b0 = this.bag?.getBagSize(0) ?? 0,  b1 = this.bag?.getBagSize(1) ?? 0;
    const d0 = this.bag?.getDiscardSize(0) ?? 0, d1 = this.bag?.getDiscardSize(1) ?? 0;

    // Panel P0 (dorado)
    this.gFx.fillStyle(0x2a1500, 0.82); this.gFx.fillRoundedRect(8, 70, 158, 38, 6);
    this.gFx.lineStyle(2, PLAYER_COLORS[0], 0.9); this.gFx.strokeRoundedRect(8, 70, 158, 38, 6);
    // Panel P1 (azul)
    this.gFx.fillStyle(0x0a1528, 0.82); this.gFx.fillRoundedRect(8, 114, 158, 38, 6);
    this.gFx.lineStyle(2, PLAYER_COLORS[1], 0.9); this.gFx.strokeRoundedRect(8, 114, 158, 38, 6);
    // Panel iniciativa
    this.gFx.fillStyle(0x1a1000, 0.75); this.gFx.fillRoundedRect(8, 158, 158, 28, 6);

    const mkTxt = (x: number, y: number, t: string, col: string) =>
      this.add.text(x, y, t, { fontFamily: 'Georgia,serif', fontSize: '12px', color: col, stroke: '#000', strokeThickness: 2.5 }).setDepth(20);

    mkTxt(16, 77,  `🟡 Bolsa: ${b0}  Desc: ${d0}`, '#e8b840');
    mkTxt(16, 121, `🔵 Bolsa: ${b1}  Desc: ${d1}`, '#8aaae8');

    const ih = this.state.initiativeHolder;
    mkTxt(16, 163, `⚑ Iniciativa: ${ih === 0 ? 'Vos' : 'IA'}`,
      ih === 0 ? '#e8b840' : '#8aaae8');
  }
}
