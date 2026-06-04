// ============================================================
// IA TÁCTICA — War in the Chest
//
// Estrategia greedy basada en War Chest:
// 1. CONTROL: colocar bandera en punto de control (máxima prioridad)
// 2. ATTACK: eliminar unidades enemigas
// 3. MOVE: avanzar hacia puntos de control sin bandera propia
// 4. DEPLOY: desplegar unidades en ubicaciones estratégicas
// 5. BOLSTER: apilar monedas para aumentar resistencia
// 6. RECRUIT: reclutar monedas para enriquecer la bolsa
// 7. PASS: último recurso
// ============================================================

import {
  GameState, HexCoord, Coin, UnitType, Unit, PlayerIndex
} from '../../types/game.types';
import {
  hexDistance, hexesInRange, coordKey, isInBoard, hexNeighbors
} from '../HexMath';
import { BOARD_RADIUS, CONTROL_POINTS } from '../data/BoardData';
import { UNIT_STATS, CONTROL_POINTS_TO_WIN } from '../data/UnitData';

type AIAction =
  | { action: 'deploy';    coinId: string; coinType: UnitType;  targetCoord: HexCoord }
  | { action: 'move';      coinId: string; coinType: UnitType;  targetCoord: HexCoord }
  | { action: 'attack';    coinId: string; coinType: UnitType;  targetCoord: HexCoord }
  | { action: 'control';   coinId: string; coinType: UnitType;  targetCoord: HexCoord }
  | { action: 'bolster';   coinId: string; coinType: UnitType;  targetCoord: HexCoord }
  | { action: 'recruit';   coinId: string; coinType: UnitType }
  | { action: 'pass';      coinId: string };

export class AIPlayer {
  private readonly ME: PlayerIndex = 1;
  private readonly OPP: PlayerIndex = 0;

  calculateTurn(state: GameState): AIAction[] {
    const actions: AIAction[] = [];
    const usedIds = new Set<string>(state.usedCoinIds);

    for (const coin of state.hands[this.ME]) {
      if (usedIds.has(coin.id)) continue;
      const best = this._bestAction(coin, state);
      if (best) {
        actions.push(best);
        usedIds.add(coin.id);
      }
    }
    return actions;
  }

  private _bestAction(coin: Coin, state: GameState): AIAction | null {
    if (coin.kind === 'royal') {
      // Royal → Recruit si hay supply disponible, si no Initiativa, si no Pass
      const canRecruit = Object.values(state.coinSupply[this.ME]).some((n) => n > 0);
      if (canRecruit && state.round > 2) {
        const type = this._bestRecruitType(state);
        if (type) return { action: 'recruit', coinId: coin.id, coinType: type };
      }
      return { action: 'pass', coinId: coin.id };
    }

    const type = coin.unitType!;
    const scored: { score: number; act: AIAction }[] = [];

    // CONTROL: colocar bandera
    for (const coord of this._getControlSpots(state)) {
      scored.push({ score: this._scoreControl(coord, state), act: { action: 'control', coinId: coin.id, coinType: type, targetCoord: coord } });
    }

    // ATTACK: atacar enemigos
    if (UNIT_STATS[type].attackRange > 0) {
      for (const { atk, coord } of this._getAttacks(type, state)) {
        scored.push({ score: this._scoreAttack(atk, coord, state), act: { action: 'attack', coinId: coin.id, coinType: type, targetCoord: coord } });
      }
    }

    // DEPLOY: desplegar nueva unidad
    for (const coord of this._getDeploySpots(type, state)) {
      scored.push({ score: this._scoreDeploy(coord, state), act: { action: 'deploy', coinId: coin.id, coinType: type, targetCoord: coord } });
    }

    // MOVE: mover hacia objetivos
    for (const { unit, coord } of this._getMoves(type, state)) {
      scored.push({ score: this._scoreMove(unit, coord, state), act: { action: 'move', coinId: coin.id, coinType: type, targetCoord: coord } });
    }

    // BOLSTER: apilar en unidad existente
    for (const { unit } of this._getBolsterTargets(type, state)) {
      scored.push({ score: this._scoreBolster(unit, state), act: { action: 'bolster', coinId: coin.id, coinType: type, targetCoord: unit.position } });
    }

    // RECRUIT: reclutar si hay supply
    if ((state.coinSupply[this.ME][type] ?? 0) > 0 && state.round > 3) {
      scored.push({ score: 5, act: { action: 'recruit', coinId: coin.id, coinType: type } });
    }

    if (scored.length === 0) return { action: 'pass', coinId: coin.id };
    scored.sort((a, b) => b.score - a.score);
    return scored[0].act;
  }

  // ---- Opciones disponibles ----

  private _getControlSpots(state: GameState): HexCoord[] {
    const spots: HexCoord[] = [];
    state.tiles.forEach((tile) => {
      if (
        tile.tileType === 'controlLocation' &&
        tile.unit?.owner === this.ME &&
        tile.controlledBy !== this.ME
      ) spots.push(tile.coord);
    });
    return spots;
  }

  private _getAttacks(
    type: UnitType, state: GameState
  ): { atk: Unit; coord: HexCoord }[] {
    const results: { atk: Unit; coord: HexCoord }[] = [];
    const range = UNIT_STATS[type].attackRange;
    this._myUnits(type, state).forEach((unit) => {
      hexesInRange(unit.position, range).forEach((c) => {
        if (!isInBoard(c, BOARD_RADIUS)) return;
        const t = state.tiles.get(coordKey(c));
        if (t?.unit?.owner === this.OPP) results.push({ atk: unit, coord: c });
      });
    });
    return results;
  }

  private _getMoves(
    type: UnitType, state: GameState
  ): { unit: Unit; coord: HexCoord }[] {
    const results: { unit: Unit; coord: HexCoord }[] = [];
    const range = UNIT_STATS[type].moveRange;
    this._myUnits(type, state).forEach((unit) => {
      hexesInRange(unit.position, range).forEach((c) => {
        if (!isInBoard(c, BOARD_RADIUS)) return;
        if (!state.tiles.get(coordKey(c))?.unit) results.push({ unit, coord: c });
      });
    });
    return results;
  }

  private _getDeploySpots(type: UnitType, state: GameState): HexCoord[] {
    const stats = UNIT_STATS[type];
    let countOnBoard = 0;
    state.tiles.forEach((t) => {
      if (t.unit?.owner === this.ME && t.unit.type === type) countOnBoard++;
    });
    const maxAllowed = stats.canHaveMultiple ? 2 : 1;
    if (countOnBoard >= maxAllowed) return [];

    const spots: HexCoord[] = [];
    if (stats.flexibleDeploy) {
      const seen = new Set<string>();
      state.tiles.forEach((tile) => {
        if (tile.unit?.owner === this.ME) {
          hexNeighbors(tile.coord).forEach((n) => {
            const k = coordKey(n);
            if (!seen.has(k) && isInBoard(n, BOARD_RADIUS) && !state.tiles.get(k)?.unit) {
              seen.add(k); spots.push(n);
            }
          });
        }
      });
    } else {
      state.tiles.forEach((tile) => {
        if (
          tile.tileType === 'controlLocation' &&
          tile.controlledBy === this.ME &&
          !tile.unit
        ) spots.push(tile.coord);
      });
    }
    return spots;
  }

  private _getBolsterTargets(
    type: UnitType, state: GameState
  ): { unit: Unit }[] {
    const results: { unit: Unit }[] = [];
    this._myUnits(type, state).forEach((unit) => {
      results.push({ unit });
    });
    return results;
  }

  private _myUnits(type: UnitType, state: GameState): Unit[] {
    const units: Unit[] = [];
    state.tiles.forEach((t) => {
      if (t.unit?.owner === this.ME && t.unit.type === type) units.push(t.unit);
    });
    return units;
  }

  private _bestRecruitType(state: GameState): UnitType | null {
    let best: UnitType | null = null, bestSup = 0;
    for (const [type, supply] of Object.entries(state.coinSupply[this.ME])) {
      if ((supply as number) > bestSup) { bestSup = supply as number; best = type as UnitType; }
    }
    return best;
  }

  // ---- Funciones de puntuación ----

  private _scoreControl(coord: HexCoord, state: GameState): number {
    let score = 60;
    score += state.controlMarkersOnBoard[this.ME] * 8;
    const tile = state.tiles.get(coordKey(coord))!;
    if (tile.controlledBy === this.OPP) score += 25; // Quitar bandera enemiga
    // Urgente si cerca de ganar
    if (state.controlMarkersOnBoard[this.ME] >= CONTROL_POINTS_TO_WIN - 1) score += 40;
    return score;
  }

  private _scoreAttack(atk: Unit, targetCoord: HexCoord, state: GameState): number {
    const def = state.tiles.get(coordKey(targetCoord))?.unit;
    if (!def) return -100;
    let score = 20;
    if (def.stack === 1) score += 50; // Eliminar unidad
    else score += (3 - def.stack) * 8; // Debilitar unidad gruesa
    const tile = state.tiles.get(coordKey(targetCoord));
    if (tile?.tileType === 'controlLocation') score += 15;
    return score;
  }

  private _scoreMove(unit: Unit, target: HexCoord, state: GameState): number {
    let score = 0;
    const tile = state.tiles.get(coordKey(target));
    if (tile?.tileType === 'controlLocation') {
      score += tile.controlledBy === this.ME ? 8 : 40;
    }
    score += Math.max(0, 5 - hexDistance(target, { q: 0, r: 0 })) * 2;

    // Acercarse a puntos de control que tiene el enemigo
    for (const cp of CONTROL_POINTS) {
      const cpTile = state.tiles.get(coordKey(cp));
      if (cpTile?.controlledBy === this.OPP) {
        score += Math.max(0, 5 - hexDistance(target, cp)) * 4;
      }
    }
    return score;
  }

  private _scoreDeploy(spot: HexCoord, state: GameState): number {
    let score = 10;
    const tile = state.tiles.get(coordKey(spot));
    if (tile?.tileType === 'controlLocation' && tile.controlledBy !== this.ME) score += 22;
    score += Math.max(0, 4 - hexDistance(spot, { q: 0, r: 0 })) * 3;
    return score;
  }

  private _scoreBolster(unit: Unit, _state: GameState): number {
    // Bolstear vale si la unidad está en posición valiosa o amenazada
    let score = -5; // Default no vale la pena
    const tile = _state.tiles.get(coordKey(unit.position));
    if (tile?.tileType === 'controlLocation' && tile.controlledBy === this.ME) score += 20;
    if (unit.stack === 1) score += 10; // Reforzar unidad débil
    return score;
  }
}
