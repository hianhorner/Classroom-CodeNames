import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppTopBar } from '../components/AppTopBar';
import { BoardGrid } from '../components/BoardGrid';
import { RoundSummaryModal } from '../components/RoundSummaryModal';
import { TimerPanel } from '../components/TimerPanel';
import { VictoryPage } from '../components/VictoryPage';
import { useCanvasTheme } from '../hooks/useCanvasTheme';
import { useRoomState } from '../hooks/useRoomState';

export function PresentationPage() {
  const navigate = useNavigate();
  const { roomCode = '' } = useParams();
  const normalizedRoomCode = roomCode.toUpperCase();
  const { state, session, isLoading, error, actions } = useRoomState(normalizedRoomCode, 'presentation');
  const [showTurnVotes, setShowTurnVotes] = useState(true);
  const [showPassiveVotes, setShowPassiveVotes] = useState(false);
  const [isConfirmingEndEarly, setIsConfirmingEndEarly] = useState(false);
  const [copyState, setCopyState] = useState<'copy' | 'copied' | 'failed'>('copy');
  const joinLinkRef = useRef<HTMLAnchorElement | null>(null);
  const currentTurnTeam = state?.room.currentTurnTeam ?? null;
  const isVictoryState =
    state?.room.status === 'finished' &&
    Boolean(state.gameResultSummary);

  useCanvasTheme(isVictoryState ? state?.room.winningTeam ?? 'silver' : 'silver');

  useEffect(() => {
    setShowTurnVotes(true);
    setShowPassiveVotes(false);
  }, [currentTurnTeam]);

  useEffect(() => {
    if (state?.room.status === 'lobby') {
      navigate(`/room/${normalizedRoomCode}/lobby`, { replace: true });
    }
  }, [navigate, normalizedRoomCode, state?.room.status]);

  if (isLoading || !state) {
    return <main className="page-shell"><section className="paper-panel"><p>Loading presentation screen…</p></section></main>;
  }

  const showRedVotes =
    currentTurnTeam === 'red'
      ? showTurnVotes
      : currentTurnTeam === 'blue'
        ? showPassiveVotes
        : false;
  const showBlueVotes =
    currentTurnTeam === 'blue'
      ? showTurnVotes
      : currentTurnTeam === 'red'
        ? showPassiveVotes
        : false;
  const turnToneClass =
    currentTurnTeam === 'red'
      ? 'presentation-meta-card--turn-red'
      : currentTurnTeam === 'blue'
        ? 'presentation-meta-card--turn-blue'
        : '';
  const canReveal = Boolean(state.viewer.canReveal && session?.playerId);
  const canEndTurn = Boolean(state.viewer.canEndTurn && session?.playerId);
  const canEndGuessingEarly = Boolean(state.viewer.canEndGuessingEarly && session?.playerId);
  const canContinueSummary = Boolean(state.viewer.canContinueSummary && session?.playerId);
  const teacherSession = session?.playerId;
  const summary = state.room.status !== 'finished' && state.room.gamePhase === 'summary' ? state.roundSummary : null;
  const gameResultSummary = state.gameResultSummary;

  function copyWithFallback(value: string) {
    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', 'true');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  async function handleCopyJoinLink() {
    const fallbackJoinLink = state?.joinLink ?? '';
    const hrefValue = joinLinkRef.current?.getAttribute('href')?.trim() || fallbackJoinLink;

    if (!hrefValue) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(hrefValue);
      } else if (!copyWithFallback(hrefValue)) {
        throw new Error('Clipboard copy failed.');
      }

      setCopyState('copied');
    } catch {
      setCopyState(copyWithFallback(hrefValue) ? 'copied' : 'failed');
    }

    window.setTimeout(() => setCopyState('copy'), 1600);
  }

  function handleReveal(tileId: string) {
    if (!teacherSession) {
      return;
    }

    actions.emit('tile:reveal', {
      roomCode: normalizedRoomCode,
      playerId: teacherSession,
      tileId
    });
  }

  function handleAdvanceTurn() {
    if (!teacherSession) {
      return;
    }

    actions.emit('turn:advance', {
      roomCode: normalizedRoomCode,
      playerId: teacherSession
    });
  }

  function handleEndGuessingEarly() {
    if (!teacherSession) {
      return;
    }

    actions.emit('turn:end-early', {
      roomCode: normalizedRoomCode,
      playerId: teacherSession
    });
    setIsConfirmingEndEarly(false);
  }

  function handleRematch() {
    if (!teacherSession) {
      return;
    }

    actions.emit('game:rematch', {
      roomCode: normalizedRoomCode,
      playerId: teacherSession
    });
  }

  function handleStartOver() {
    if (!teacherSession) {
      return;
    }

    actions.emit('game:start-over', {
      roomCode: normalizedRoomCode,
      playerId: teacherSession
    });
  }

  if (state.room.status === 'finished' && gameResultSummary) {
    return (
      <>
        <AppTopBar
          variant="surface"
          rightSlot={<div className="app-topbar__profile">{state.viewer.name ?? 'Presentation'}</div>}
        />
        <div className="page-shell page-shell--with-topbar">
          <VictoryPage
            summary={gameResultSummary}
            canControl={Boolean(teacherSession)}
            onRematch={handleRematch}
            onStartOver={handleStartOver}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <AppTopBar
        variant="surface"
        rightSlot={
          <div className="app-topbar__action-cluster app-topbar__action-cluster--presentation">
            <div className="status-chip">Room {state.room.roomCode}</div>
            <button type="button" className="button button--secondary button--compact" onClick={handleCopyJoinLink}>
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Retry Copy' : 'Copy Student Link'}
            </button>
            <a
              ref={joinLinkRef}
              className="button button--secondary button--compact"
              href={state.joinLink}
              target="_blank"
              rel="noreferrer"
            >
              Open Student Link
            </a>
            {teacherSession && state.room.status !== 'finished' && !summary && state.clue.isActive ? (
              <>
                <button
                  type="button"
                  className="button button--success button--compact"
                  onClick={() => setIsConfirmingEndEarly(true)}
                  disabled={!canEndGuessingEarly}
                >
                  End Guessing Early
                </button>
                <button
                  type="button"
                  className="button button--success button--compact"
                  onClick={handleAdvanceTurn}
                  disabled={!canEndTurn}
                >
                  End Turn
                </button>
              </>
            ) : null}
          </div>
        }
      />

      <main className="page-shell page-shell--presentation page-shell--with-topbar presentation-stage">
        <div className="presentation-layout">
          <section className="presentation-board-frame">
            <BoardGrid
              tiles={state.board}
              interactive={canReveal}
              revealMode
              variant="presentation"
              voteDisplayMode="split"
              activeTeam={state.room.currentTurnTeam}
              showRedVotes={showRedVotes}
              showBlueVotes={showBlueVotes}
              onTileClick={handleReveal}
            />
            <div className="presentation-vote-toggles">
              <button
                type="button"
                className={`button button--secondary button--compact ${showTurnVotes ? 'button--selected' : ''}`}
                onClick={() => setShowTurnVotes((currentValue) => !currentValue)}
              >
                Turn Votes
              </button>
              <button
                type="button"
                className={`button button--secondary button--compact ${showPassiveVotes ? 'button--selected' : ''}`}
                onClick={() => setShowPassiveVotes((currentValue) => !currentValue)}
              >
                Passive Votes
              </button>
            </div>
          </section>

          <aside className="presentation-side-panel">
            <article className={`paper-panel presentation-meta-card ${turnToneClass}`}>
              <p className="eyebrow">Current Clue</p>
              <h2 className="presentation-meta-card__value">{state.clue.text ?? '---'}</h2>
            </article>

            <article className={`paper-panel presentation-meta-card ${turnToneClass}`}>
              <p className="eyebrow">Choices Per Guesser</p>
              <h2 className="presentation-meta-card__value">{state.clue.count}</h2>
            </article>

            <article className={`paper-panel presentation-meta-card ${turnToneClass}`}>
              <p className="eyebrow">Reveals Left</p>
              <h2 className="presentation-meta-card__value">{state.clue.remainingReveals}</h2>
            </article>

            <div
              className={`presentation-team-card ${
                currentTurnTeam === 'red' ? 'presentation-team-card--active-red' : 'presentation-team-card--inactive'
              }`}
            >
              <span>Red Team</span>
              <strong>{state.teamStatus.red.remainingWords}</strong>
              <small>{currentTurnTeam === 'red' ? 'Your turn' : 'Waiting'}</small>
            </div>

            <div
              className={`presentation-team-card ${
                currentTurnTeam === 'blue' ? 'presentation-team-card--active-blue' : 'presentation-team-card--inactive'
              }`}
            >
              <span>Blue Team</span>
              <strong>{state.teamStatus.blue.remainingWords}</strong>
              <small>{currentTurnTeam === 'blue' ? 'Your turn' : 'Waiting'}</small>
            </div>

            <TimerPanel
              seconds={state.timer.remainingSeconds}
              enabled={state.timer.enabled}
              state={state.timer.state}
              controls={
                teacherSession
                  ? {
                      onStart: () =>
                        actions.emit('timer:start', {
                          roomCode: normalizedRoomCode,
                          playerId: teacherSession
                        }),
                      onPause: () =>
                        actions.emit('timer:pause', {
                          roomCode: normalizedRoomCode,
                          playerId: teacherSession
                        }),
                      onReset: () =>
                        actions.emit('timer:reset', {
                          roomCode: normalizedRoomCode,
                          playerId: teacherSession
                        })
                    }
                  : undefined
              }
            />

            {error ? <p className="error-banner">{error}</p> : null}
          </aside>
        </div>
        {summary ? (
          <RoundSummaryModal
            summary={summary}
            variant="presentation"
            canContinue={canContinueSummary}
            onContinue={handleAdvanceTurn}
          />
        ) : null}
        {isConfirmingEndEarly ? (
          <div className="round-summary-overlay round-summary-overlay--presentation" role="dialog" aria-modal="true">
            <div className="round-summary-overlay__backdrop" onClick={() => setIsConfirmingEndEarly(false)} />
            <section className="paper-panel confirm-modal">
              <header className="confirm-modal__header">
                <p className="eyebrow">Confirm Choice</p>
                <h2>End guessing early?</h2>
                <p className="supporting-text">
                  This will end the round immediately and move the game to the turn summary.
                </p>
              </header>
              <footer className="confirm-modal__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setIsConfirmingEndEarly(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button--success"
                  onClick={handleEndGuessingEarly}
                >
                  Confirm End Early
                </button>
              </footer>
            </section>
          </div>
        ) : null}
      </main>
    </>
  );
}
