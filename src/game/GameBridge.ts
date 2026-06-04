// ============================================================
// GAME BRIDGE — War in the Chest
//
// Puente de comunicación entre Phaser (juego) y React (UI).
// Phaser emite eventos → React escucha y actualiza la interfaz.
// React envía comandos → Phaser ejecuta la acción.
// ============================================================

import { UIState, Coin, ActionType, UnitType } from '../types/game.types';

type EventCallback = (...args: any[]) => void;

class GameBridgeClass {
  private listeners: Map<string, EventCallback[]> = new Map();

  emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((cb) => cb(...args));
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event) || [];
    this.listeners.set(event, callbacks.filter((cb) => cb !== callback));
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  getInitialUIState(): UIState {
    const emptySupply: Record<UnitType, number> = {
      swordsman: 0, pikeman: 0, archer: 0, light_cavalry: 0,
      royal_guard: 0, berserker: 0, warrior_priest: 0, mercenary: 0,
      ensign: 0, scout: 0,
      cavalry: 0, crossbowman: 0, footman: 0, knight: 0, lancer: 0, marshal: 0,
    };
    return {
      phase: 'playing',
      round: 1,
      currentPlayer: 0,
      initiativeHolder: 0,
      hands: [[], []],
      bagSizes: [0, 0],
      discardSizes: [0, 0],
      coinSupply: [{ ...emptySupply }, { ...emptySupply }],
      controlMarkersOnBoard: [0, 0],
      coinsDestroyed: [0, 0],
      selectedCoinId: null,
      pendingAction: null,
      usedCoinIds: [],
      winner: null,
      winReason: '',
      message: 'Iniciando partida...',
    };
  }

  // ---- Comandos de React → Phaser ----

  selectCoin(coin: Coin): void {
    this.emit('coinClicked', coin);
  }

  chooseAction(action: ActionType): void {
    this.emit('actionChosen', action);
  }

  // Para el Recruit boca abajo: elige el tipo de unidad a reclutar
  chooseRecruitType(unitType: UnitType): void {
    this.emit('recruitTypeChosen', unitType);
  }

  draftSelectUnit(unitType: UnitType): void {
    this.emit('draftUnitSelected', unitType);
  }

  endTurn(): void {
    this.emit('endTurnRequested');
  }

  restartGame(): void {
    this.emit('restartRequested');
  }
}

export const GameBridge = new GameBridgeClass();
