// ============================================================
// SISTEMA DE BOLSA — War in the Chest
//
// Mecánica BAG-BUILDING fiel a War Chest:
//
// - Cada jugador tiene BOLSA + MANO + DESCARTE + SUPPLY
// - Al inicio del turno: roba N monedas al azar de la bolsa
// - Usa cada moneda para 1 acción (boca arriba o boca abajo)
// - Monedas usadas van al DESCARTE (excepto deploy/bolster que van al tablero)
// - Bolsa vacía: rebaraja descarte → bolsa
//
// DEPLOY/BOLSTER: la moneda pasa de mano → tablero (unit.coins)
// FACE-DOWN (Recruit/Initiative/Pass): moneda → descarte
// FACE-UP (Move/Attack/Control/Tactic): moneda → descarte al fin del turno
//
// ROYAL COIN: moneda especial que SOLO puede jugarse boca abajo
// ============================================================

import { Coin, UnitType, PlayerIndex } from '../../types/game.types';
import {
  COINS_PER_TURN, ROYAL_COINS_PER_PLAYER, RECRUIT_COINS
} from '../data/UnitData';

let coinIdCounter = 0;

function createUnitCoin(type: UnitType): Coin {
  return { id: `c${++coinIdCounter}`, kind: 'unit', unitType: type };
}

function createRoyalCoin(): Coin {
  return { id: `r${++coinIdCounter}`, kind: 'royal' };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class BagSystem {
  bags:     Coin[][] = [[], []];
  hands:    Coin[][] = [[], []];
  discards: Coin[][] = [[], []];
  coinSupply: Record<UnitType, number>[];

  // playerTypes: tipos que eligió cada jugador en el draft
  constructor(initialSupply: Record<UnitType, number>[], playerTypes: [UnitType[], UnitType[]]) {
    this.coinSupply = initialSupply.map((s) => ({ ...s }));
    this._initBagsFromTypes(playerTypes);
  }

  // Bolsa inicial: 2 monedas de cada tipo elegido + Royal Coins
  private _initBagsFromTypes(playerTypes: [UnitType[], UnitType[]]): void {
    for (let p = 0; p < 2; p++) {
      const bag: Coin[] = [];
      for (const type of playerTypes[p]) {
        bag.push(createUnitCoin(type));
        bag.push(createUnitCoin(type));
      }
      for (let i = 0; i < ROYAL_COINS_PER_PLAYER; i++) {
        bag.push(createRoyalCoin());
      }
      this.bags[p]     = shuffle(bag);
      this.hands[p]    = [];
      this.discards[p] = [];
    }
  }

  /**
   * Roba hasta `count` monedas de la bolsa al azar.
   * Si la bolsa se vacía, rebaraja el descarte en la bolsa.
   */
  drawCoins(player: PlayerIndex, count: number = COINS_PER_TURN): Coin[] {
    const drawn: Coin[] = [];
    for (let i = 0; i < count; i++) {
      if (this.bags[player].length === 0) {
        if (this.discards[player].length === 0) break;
        this.bags[player] = shuffle([...this.discards[player]]);
        this.discards[player] = [];
      }
      drawn.push(this.bags[player].pop()!);
    }
    this.hands[player] = drawn;
    return drawn;
  }

  /**
   * Descarta todas las monedas restantes de la mano (al fin del turno).
   * Las monedas de Deploy/Bolster ya fueron removidas antes con removeFromHand.
   */
  discardHand(player: PlayerIndex): void {
    this.discards[player].push(...this.hands[player]);
    this.hands[player] = [];
  }

  /**
   * Remueve una moneda específica de la mano (para Deploy/Bolster).
   * Esa moneda va al tablero como unidad, no al descarte.
   * Retorna la moneda removida, o null si no estaba en la mano.
   */
  removeFromHand(player: PlayerIndex, coinId: string): Coin | null {
    const idx = this.hands[player].findIndex((c) => c.id === coinId);
    if (idx === -1) return null;
    return this.hands[player].splice(idx, 1)[0];
  }

  /**
   * Agrega una moneda directamente al descarte (para acciones boca abajo).
   */
  addToDiscard(player: PlayerIndex, coin: Coin): void {
    this.discards[player].push(coin);
  }

  /**
   * Acción RECLUTAR (boca abajo):
   * Toma RECRUIT_COINS monedas del supply y las pone en el descarte.
   * Retorna cuántas monedas se reclutaron realmente.
   */
  recruit(player: PlayerIndex, type: UnitType): number {
    const available = this.coinSupply[player][type];
    const toAdd = Math.min(available, RECRUIT_COINS);
    for (let i = 0; i < toAdd; i++) {
      this.discards[player].push(createUnitCoin(type));
    }
    this.coinSupply[player][type] -= toAdd;
    return toAdd;
  }

  getBagSize(player: PlayerIndex): number {
    return this.bags[player].length;
  }

  getDiscardSize(player: PlayerIndex): number {
    return this.discards[player].length;
  }

  getTotalInCycle(player: PlayerIndex): number {
    return this.bags[player].length
      + this.hands[player].length
      + this.discards[player].length;
  }

  getSupply(player: PlayerIndex, type: UnitType): number {
    return this.coinSupply[player][type];
  }

  /** Composición de la bolsa + descarte (para display) */
  getBagComposition(player: PlayerIndex): Record<UnitType, number> {
    const comp: Record<UnitType, number> = {
      swordsman: 0, pikeman: 0, archer: 0, light_cavalry: 0,
      royal_guard: 0, berserker: 0, warrior_priest: 0, mercenary: 0,
      ensign: 0, scout: 0,
      cavalry: 0, crossbowman: 0, footman: 0, knight: 0, lancer: 0, marshal: 0,
    };
    for (const coin of [...this.bags[player], ...this.discards[player]]) {
      if (coin.kind === 'unit' && coin.unitType) {
        comp[coin.unitType]++;
      }
    }
    return comp;
  }

}
