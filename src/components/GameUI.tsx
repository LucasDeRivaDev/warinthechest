// ============================================================
// GAME UI — War in the Chest (fiel a War Chest)
//
// Interfaz que refleja exactamente las mecánicas:
// - Monedas en mano (con indicador de tipo: unidad / royal)
// - Acciones BOCA ARRIBA (face-up): deploy, move, attack, bolster, control, tactic
// - Acciones BOCA ABAJO (face-down): recruit, initiative, pass
// - Indicador de iniciativa
// - Progreso de banderas de control
// ============================================================

import { UIState, Coin, ActionType, FaceUpAction, FaceDownAction, UnitType, CoinKind, DraftState } from '../types/game.types';
import { GameBridge } from '../game/GameBridge';
import { UNIT_STATS, PLAYER_NAMES, CONTROL_POINTS_TO_WIN } from '../game/data/UnitData';
import './GameUI.css';

interface Props { uiState: UIState; }

const UNIT_ICON: Record<UnitType, string> = {
  swordsman: '⚔️',  pikeman: '🗡️',    archer: '🏹',
  light_cavalry: '🐴', royal_guard: '🛡️', berserker: '😤',
  warrior_priest: '✝️', mercenary: '💰',   ensign: '🚩',
  scout: '🔭',       cavalry: '⚔🐴',   crossbowman: '🏹',
  footman: '👣',     knight: '🤺',      lancer: '🔱',
  marshal: '⭐',
};

const FACE_UP_ACTIONS: { action: FaceUpAction; label: string; color: string }[] = [
  { action: 'deploy',  label: '+ Desplegar',  color: '#2288ff' },
  { action: 'move',    label: '↔ Mover',      color: '#22bb44' },
  { action: 'attack',  label: '⚔ Atacar',     color: '#dd2222' },
  { action: 'bolster', label: '⬆ Bolster',    color: '#cc8800' },
  { action: 'control', label: '✦ Control',    color: '#ffdd00' },
  { action: 'tactic',  label: '★ Táctica',    color: '#cc44ff' },
];

const FACE_DOWN_ACTIONS: { action: FaceDownAction; label: string; color: string }[] = [
  { action: 'recruit',    label: '📦 Reclutar',   color: '#44aacc' },
  { action: 'initiative', label: '⚑ Iniciativa', color: '#ffaa44' },
  { action: 'pass',       label: '⏭ Pasar',       color: '#666666' },
];

export function GameUI({ uiState }: Props) {
  const {
    phase, round, currentPlayer, initiativeHolder,
    hands, bagSizes, discardSizes, coinSupply,
    controlMarkersOnBoard, selectedCoinId, pendingAction,
    usedCoinIds, winner, winReason, message,
    selectedCoinKind, selectedUnitType, draft,
  } = uiState;

  const isPlayerTurn = currentPlayer === 0 && phase !== 'gameover';
  const playerHand: Coin[] = hands?.[0] || [];
  const selectedCoin = playerHand.find((c) => c.id === selectedCoinId) ?? null;

  // Para Recruit: mostrar opciones de tipo de unidad si estamos esperando
  const waitingForRecruitType = pendingAction === 'recruit' && isPlayerTurn;

  return (
    <div className="game-ui">

      {/* ---- TOP BAR ---- */}
      <div className="top-bar">
        <div className="turn-info">
          <span className="turn-num">Ronda {round}</span>
          <span className={`player-badge ${currentPlayer === 0 ? 'badge-blue' : 'badge-red'}`}>
            {phase === 'gameover' ? '🏆 Fin de partida'
              : currentPlayer === 0 ? '⚔ Tu turno'
              : '🤖 IA jugando...'}
          </span>
          {initiativeHolder === 0
            ? <span className="initiative-badge initiative-blue">⚑ Iniciativa</span>
            : <span className="initiative-badge initiative-red">⚑ IA tiene iniciativa</span>
          }
        </div>

        {/* Progreso de control */}
        <div className="flag-progress">
          <div className="flag-bar">
            <div
              className="flag-fill flag-fill-blue"
              style={{ width: `${(controlMarkersOnBoard[0] / CONTROL_POINTS_TO_WIN) * 100}%` }}
            />
          </div>
          <div className="flag-scores">
            <span className="flag-score-blue">◆ {controlMarkersOnBoard[0]}</span>
            <span className="flag-goal">/ {CONTROL_POINTS_TO_WIN}</span>
            <span className="flag-score-red">{controlMarkersOnBoard[1]} ◆</span>
          </div>
          <div className="flag-bar">
            <div
              className="flag-fill flag-fill-red"
              style={{ width: `${(controlMarkersOnBoard[1] / CONTROL_POINTS_TO_WIN) * 100}%` }}
            />
          </div>
        </div>

        <div className="bag-info-mini">
          <span title="Bolsa Azul">🎒{bagSizes[0]}</span>
          <span className="bag-divider">·</span>
          <span title="Bolsa Roja">🎒{bagSizes[1]}</span>
        </div>
      </div>

      {/* ---- MENSAJE ---- */}
      {message && <div className="message-bar">{message}</div>}

      {/* ---- PANEL INFERIOR ---- */}
      {phase !== 'gameover' && (
        <div className="bottom-panel">

          {/* Monedas en mano */}
          <div className="hand-section">
            <div className="section-label">Tu mano ({playerHand.length})</div>
            <div className="hand-coins">
              {playerHand.length === 0
                ? <span className="empty-hand">Sin monedas</span>
                : playerHand.map((coin) => {
                    const isUsed     = usedCoinIds.includes(coin.id);
                    const isSelected = coin.id === selectedCoinId;
                    const isRoyal    = coin.kind === 'royal';
                    const stat       = isRoyal ? null : UNIT_STATS[coin.unitType!];
                    return (
                      <button
                        key={coin.id}
                        className={[
                          'coin-btn',
                          isRoyal   ? 'coin-royal'    : '',
                          isUsed    ? 'coin-used'     : '',
                          isSelected ? 'coin-selected' : '',
                          !isPlayerTurn ? 'coin-disabled' : '',
                        ].join(' ')}
                        onClick={() => !isUsed && isPlayerTurn && GameBridge.selectCoin(coin)}
                        title={isRoyal ? 'Moneda Real — solo boca abajo'
                          : `${stat!.name} — ${stat!.tacticDescription}`}
                        disabled={isUsed || !isPlayerTurn}
                      >
                        <span className="coin-icon">
                          {isRoyal ? '👑' : UNIT_ICON[coin.unitType!]}
                        </span>
                        <span className="coin-name">
                          {isRoyal ? 'REAL' : stat!.shortName}
                        </span>
                        {isUsed && <span className="coin-check">✓</span>}
                      </button>
                    );
                  })}
            </div>
          </div>

          {/* Acciones para la moneda seleccionada */}
          {selectedCoin && isPlayerTurn && !waitingForRecruitType && (
            <div className="actions-section">
              <div className="action-title">
                {selectedCoinKind === 'royal'
                  ? '👑 Moneda Real'
                  : `${UNIT_ICON[selectedUnitType!]} ${UNIT_STATS[selectedUnitType!].name}`
                }
              </div>

              {/* Acciones BOCA ARRIBA (solo para monedas de unidad) */}
              {selectedCoinKind !== 'royal' && (
                <div className="action-group">
                  <div className="action-group-label">Boca arriba →</div>
                  <div className="action-row">
                    {FACE_UP_ACTIONS.map(({ action, label, color }) => {
                      const isActive = pendingAction === action;
                      return (
                        <button
                          key={action}
                          className={['action-btn', isActive ? 'action-active' : ''].join(' ')}
                          style={{ borderColor: color, color: isActive ? color : undefined }}
                          onClick={() => GameBridge.chooseAction(action)}
                          title={getActionDesc(action, selectedUnitType)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Acciones BOCA ABAJO (para cualquier moneda) */}
              <div className="action-group">
                <div className="action-group-label">Boca abajo ↓</div>
                <div className="action-row">
                  {FACE_DOWN_ACTIONS.map(({ action, label, color }) => {
                    const isActive = pendingAction === action;
                    const disabled = action === 'recruit' && selectedCoinKind !== 'royal'
                      && (coinSupply?.[0]?.[selectedUnitType!] ?? 0) <= 0;
                    return (
                      <button
                        key={action}
                        className={['action-btn', isActive ? 'action-active' : ''].join(' ')}
                        style={{ borderColor: color, color: isActive ? color : undefined }}
                        onClick={() => !disabled && GameBridge.chooseAction(action)}
                        disabled={disabled}
                        title={disabled ? 'Supply vacío' : getActionDesc(action, selectedUnitType)}
                      >
                        {label}
                        {action === 'recruit' && selectedCoinKind !== 'royal' && (
                          <span className="action-supply">
                            ({coinSupply?.[0]?.[selectedUnitType!] ?? 0})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Selector de tipo para Recruit (moneda Royal) */}
          {waitingForRecruitType && (
            <div className="actions-section">
              <div className="action-title">¿Qué tipo de unidad reclutás? (+2 al descarte)</div>
              <div className="action-row">
                {(Object.keys(UNIT_STATS) as UnitType[]).map((type) => {
                  const supply = coinSupply?.[0]?.[type] ?? 0;
                  return (
                    <button
                      key={type}
                      className="action-btn"
                      style={{ borderColor: '#44aacc' }}
                      onClick={() => GameBridge.chooseRecruitType(type)}
                      disabled={supply <= 0}
                      title={`Supply: ${supply}`}
                    >
                      {UNIT_ICON[type]} {UNIT_STATS[type].shortName}
                      <span className="action-supply">({supply})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Terminar turno */}
          {isPlayerTurn && (
            <div className="end-turn-section">
              <button className="end-turn-btn" onClick={() => GameBridge.endTurn()}>
                Terminar Turno →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- PANEL LATERAL DERECHO ---- */}
      <div className="side-panel">

        <div className="side-title">Banderas de control</div>
        {[0, 1].map((p) => (
          <div key={p} className={`flag-player-row flag-player-${p === 0 ? 'blue' : 'red'}`}>
            <span>{PLAYER_NAMES[p as 0|1]}</span>
            <div className="flag-pips">
              {Array.from({ length: CONTROL_POINTS_TO_WIN }, (_, i) => (
                <span
                  key={i}
                  className={`flag-pip ${i < controlMarkersOnBoard[p] ? 'flag-pip-filled' : ''}`}
                />
              ))}
            </div>
            <span className="flag-count">{controlMarkersOnBoard[p]}/{CONTROL_POINTS_TO_WIN}</span>
          </div>
        ))}

        <div className="side-title" style={{ marginTop: 16 }}>Unidades</div>
        {(Object.keys(UNIT_STATS) as UnitType[]).map((type) => {
          const stat   = UNIT_STATS[type];
          const supply = coinSupply?.[0]?.[type] ?? 0;
          return (
            <div key={type} className="unit-row">
              <span className="ur-icon">{UNIT_ICON[type]}</span>
              <div className="ur-info">
                <div className="ur-name">{stat.name}</div>
                <div className="ur-stats" style={{ fontSize: 9 }}>
                  ↔{stat.moveRange} ◉{stat.attackRange || '—'}
                  {stat.canHaveMultiple ? ' · ×2' : ''}
                  {stat.flexibleDeploy ? ' · Flex' : ''}
                </div>
                <div className="ur-stats" style={{ color: '#cc8855', fontSize: 9 }}>
                  {stat.tacticDescription.slice(0, 55)}…
                </div>
                <div className="ur-supply">Supply: {'●'.repeat(supply)}{'○'.repeat(Math.max(0, 3 - supply))}</div>
              </div>
            </div>
          );
        })}

        <div className="side-title" style={{ marginTop: 12 }}>Bolsa</div>
        <div className="bag-detail">
          <div className="bd-row">
            <span className="bd-blue">Azul</span>
            <span>Bag: {bagSizes[0]} · Desc: {discardSizes[0]}</span>
          </div>
          <div className="bd-row">
            <span className="bd-red">Rojo</span>
            <span>Bag: {bagSizes[1]} · Desc: {discardSizes[1]}</span>
          </div>
        </div>

        <div className="side-title" style={{ marginTop: 12 }}>Cómo jugar</div>
        <div className="help-text">
          <p>🎒 Robás 3 monedas por turno</p>
          <p>⚔ Cada moneda = 1 acción</p>
          <p>⬆ <strong>Bolster:</strong> la moneda se apila en la unidad (+1 vida)</p>
          <p>✦ <strong>Control:</strong> colocá bandera en punto de control con unidad</p>
          <p>📦 <strong>Reclutar:</strong> +2 monedas del supply al descarte</p>
          <p>⚑ <strong>Iniciativa:</strong> salís primero la próxima ronda</p>
          <p>👑 <strong>Moneda Real:</strong> solo boca abajo</p>
          <p>🏆 {CONTROL_POINTS_TO_WIN} banderas para ganar</p>
        </div>
      </div>

      {/* ---- DRAFT — SELECCIÓN DE EJÉRCITO ---- */}
      {phase === 'draft' && draft && (
        <DraftPanel draft={draft} />
      )}

      {/* ---- FIN DE JUEGO ---- */}
      {winner !== null && (
        <div className="gameover-overlay">
          <div className="gameover-card">
            <div className="go-crown">👑</div>
            <h1 className={`go-title ${winner === 0 ? 'go-blue' : 'go-red'}`}>
              {winner === 0 ? '¡Victoria!' : 'Derrota'}
            </h1>
            <p className="go-winner">{PLAYER_NAMES[winner]}</p>
            <p className="go-reason">{winReason}</p>
            <button className="go-btn" onClick={() => GameBridge.restartGame()}>
              ⟳ Nueva Partida
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ---- DRAFT PANEL ----
function DraftPanel({ draft }: { draft: DraftState }) {
  const { pool, playerDrafts, pickOrder, currentPickIndex } = draft;
  const isMyTurn    = currentPickIndex < pickOrder.length && pickOrder[currentPickIndex] === 0;
  const myPicks     = playerDrafts[0];
  const aiPicks     = playerDrafts[1];
  const picksNeeded = 3;

  return (
    <div className="draft-overlay">
      <div className="draft-card">
        <h2 className="draft-title">⚔ Selección de Ejército</h2>
        <p className="draft-subtitle">
          {isMyTurn
            ? `Tu turno — elegí una unidad (${myPicks.length}/${picksNeeded})`
            : currentPickIndex >= pickOrder.length
              ? '¡Draft completado!'
              : `IA eligiendo... (${aiPicks.length}/${picksNeeded})`
          }
        </p>

        {/* Estado de picks de cada jugador */}
        <div className="draft-picks-row">
          <div className="draft-picks-block">
            <div className="draft-picks-label" style={{ color: '#e8b840' }}>🟡 Vos</div>
            <div className="draft-picks-units">
              {myPicks.length === 0
                ? <span className="draft-pick-empty">—</span>
                : myPicks.map(t => (
                    <span key={t} className="draft-pick-chip draft-chip-me">
                      {UNIT_ICON[t]} {UNIT_STATS[t].shortName}
                    </span>
                  ))
              }
            </div>
          </div>
          <div className="draft-picks-block">
            <div className="draft-picks-label" style={{ color: '#8aaae8' }}>🔵 IA</div>
            <div className="draft-picks-units">
              {aiPicks.length === 0
                ? <span className="draft-pick-empty">—</span>
                : aiPicks.map(t => (
                    <span key={t} className="draft-pick-chip draft-chip-ai">
                      {UNIT_ICON[t]} {UNIT_STATS[t].shortName}
                    </span>
                  ))
              }
            </div>
          </div>
        </div>

        {/* Grid de unidades disponibles */}
        <div className="draft-grid">
          {pool.map((type) => {
            const stat      = UNIT_STATS[type];
            const pickedMe  = myPicks.includes(type);
            const pickedAI  = aiPicks.includes(type);
            const isPicked  = pickedMe || pickedAI;
            const canPick   = isMyTurn && !isPicked;

            return (
              <button
                key={type}
                className={[
                  'draft-unit-btn',
                  pickedMe  ? 'draft-picked-me'  : '',
                  pickedAI  ? 'draft-picked-ai'  : '',
                  isPicked  ? 'draft-picked'      : '',
                  canPick   ? 'draft-available'   : '',
                ].join(' ')}
                onClick={() => canPick && GameBridge.draftSelectUnit(type)}
                disabled={!canPick}
                title={stat.tacticDescription}
              >
                <span className="du-icon">{UNIT_ICON[type]}</span>
                <span className="du-name">{stat.name}</span>
                <span className="du-coins">×{stat.coinsInBag}</span>
                <span className="du-desc">{stat.description}</span>
                {pickedMe && <span className="du-badge du-badge-me">✓ Vos</span>}
                {pickedAI && <span className="du-badge du-badge-ai">✓ IA</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getActionDesc(action: ActionType, unitType?: UnitType): string {
  const u = unitType ? UNIT_STATS[unitType] : null;
  switch (action) {
    case 'deploy':  return `Desplegá un ${u?.name ?? 'unidad'} en un punto de control propio.`;
    case 'move':    return `Mové el ${u?.name ?? 'unidad'} hasta ${u?.moveRange ?? 1} hex.`;
    case 'attack':  return u?.attackRange === 0
      ? `${u.name} no puede atacar normalmente (usá Táctica).`
      : `Atacá con el ${u?.name ?? 'unidad'} (alcance ${u?.attackRange ?? 1}).`;
    case 'bolster': return `Apilá esta moneda sobre un ${u?.name ?? 'unidad'} aliado (+1 al stack).`;
    case 'control': return `Colocá tu bandera en el punto de control donde está tu unidad.`;
    case 'tactic':  return u ? u.tacticDescription : 'Táctica especial.';
    case 'recruit': return `Tomá 2 monedas de ${u?.name ?? 'esta unidad'} del supply → descarte.`;
    case 'initiative': return `Tomá la iniciativa y salí primero la próxima ronda.`;
    case 'pass':    return `Descartá esta moneda sin hacer nada.`;
    default:        return '';
  }
}
