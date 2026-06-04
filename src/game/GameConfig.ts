// ============================================================
// CONFIGURACIÓN DE PHASER — War in the Chest
//
// Aquí se configura el motor gráfico Phaser 3.
// Usamos WebGL con fallback a Canvas.
// ============================================================

import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

export function GameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, // WebGL si está disponible, sino Canvas
    width: window.innerWidth,
    height: window.innerHeight,
    parent,
    backgroundColor: '#2c1205',
    scene: [GameScene],
    physics: {
      default: 'arcade',
      arcade: { debug: false }
    },
    scale: {
      mode: Phaser.Scale.RESIZE, // Se adapta al tamaño de ventana
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  };
}
