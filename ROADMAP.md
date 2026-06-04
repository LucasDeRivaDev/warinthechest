# War in the Chest — Roadmap de Desarrollo

## Estado actual: MVP v0.1

---

## ✅ FASE 1 — MVP (COMPLETADO)

- [x] Proyecto base: TypeScript + React + Phaser 3 + Vite
- [x] Tablero hexagonal renderizado (radio 3 = 37 hexágonos)
- [x] Sistema de coordenadas axiales + conversión píxeles
- [x] Puntos de control estratégicos (5 hexes especiales)
- [x] Unidades con HP, colores y labels de texto
- [x] Sistema de bolsa (bag-building): robar, usar, descartar
- [x] Turno por turnos: Jugador → IA
- [x] Acciones: Mover, Atacar, Desplegar, Reclutar
- [x] Combate con ataque/defensa y modificadores
- [x] IA táctica básica (greedy scoring)
- [x] Animaciones: movimiento, flecha de arquero, impacto melee, muerte, spawn
- [x] Camera shake en impactos
- [x] Partículas de muerte
- [x] UI React: mano de monedas, acciones, puntuación, fin de juego
- [x] Condición de victoria: 3 puntos de control O eliminar todas las unidades
- [x] Habilidades especiales básicas: Guardia, Carga, Lancero vs Caballería, Furia del Berserker

---

## 🚧 FASE 2 — Pulido (Próximo)

- [ ] Pantalla de menú principal con animación
- [ ] Efectos de glow en hexes seleccionados
- [ ] Transición entre turnos (banner animado)
- [ ] Sonidos: impacto, flecha, movimiento, muerte, victoria
- [ ] Tooltip al hover sobre unidades (stats completos)
- [ ] Animación de movimiento con texto del daño flotante
- [ ] Log de combate (panel lateral con historial)
- [ ] Más tipos de unidades disponibles desde el inicio
- [ ] Mostrar el alcance de una unidad al seleccionarla

---

## 🔮 FASE 3 — Contenido

- [ ] 3 mapas adicionales (distinto radio y posición de puntos de control)
- [ ] Todas las 7 unidades desbloqueadas (caballería, guardián, explorador, berserker)
- [ ] Sistema de composición de ejército (elegir qué unidades poner en la bolsa)
- [ ] IA mejorada (algoritmo minimax o MCTS simple)
- [ ] Modo Hotseat: 2 jugadores en la misma pantalla
- [ ] Historial de partidas (quién ganó, cuántos turnos)

---

## 🌐 FASE 4 — Multiplayer Online

- [ ] Servidor Node.js + Socket.io
- [ ] Salas privadas con código
- [ ] Sincronización de estado en tiempo real
- [ ] Matchmaking simple (cola de búsqueda)
- [ ] Sistema de reconexión
- [ ] Base de datos SQLite: partidas, jugadores, rankings

---

## 🖥️ FASE 5 — Desktop App

- [ ] Empaquetar con Electron
- [ ] Instalador para Windows/Mac
- [ ] Actualizaciones automáticas
- [ ] Pantalla completa nativa
- [ ] Sonidos optimizados

---

## 💡 Ideas Futuras

- Campaña single-player con historia medieval
- Editor de mapas personalizado
- Facciones con diferentes conjuntos de unidades
- Torneo / modo liga
- Desafíos diarios
