// ============================================================
// APP.TSX — War in the Chest
//
// Componente raíz de React. Monta el canvas de Phaser y
// la UI de React superpuesta.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { GameConfig } from './game/GameConfig';
import { GameUI } from './components/GameUI';
import { GameBridge } from './game/GameBridge';
import { UIState } from './types/game.types';
import './App.css';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);
  const [uiState, setUIState] = useState<UIState>(GameBridge.getInitialUIState());

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    // Crear el juego Phaser dentro del div
    gameRef.current = new Phaser.Game(GameConfig(containerRef.current));

    // Escuchar actualizaciones de estado del juego
    const onUIUpdate = (state: UIState) => {
      setUIState((prev) => ({ ...prev, ...state }));
    };
    GameBridge.on('uiUpdate', onUIUpdate);

    return () => {
      GameBridge.off('uiUpdate', onUIUpdate);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="app-root">
      {/* El canvas de Phaser se inyecta aquí */}
      <div ref={containerRef} className="phaser-container" />

      {/* UI de React encima del canvas */}
      <GameUI uiState={uiState} />
    </div>
  );
}

export default App;
