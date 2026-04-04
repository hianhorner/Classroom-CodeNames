import { TEAM_LABELS, formatRoleLabel } from '@classroom-codenames/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppTopBar } from '../components/AppTopBar';
import { BoardGrid } from '../components/BoardGrid';
import { ChatPanel } from '../components/ChatPanel';
import { GameTopBarInfo } from '../components/GameTopBarInfo';
import { RoundSummaryModal } from '../components/RoundSummaryModal';
import { VictoryPage } from '../components/VictoryPage';
import { useCanvasTheme } from '../hooks/useCanvasTheme';
import { useRoomState } from '../hooks/useRoomState';

export function SpymasterPage() {
  const navigate = useNavigate();
  const { roomCode = '' } = useParams();
  const normalizedRoomCode = roomCode.toUpperCase();
  const { state, session, isLoading, error, actions } = useRoomState(normalizedRoomCode, 'player');
  const [clueText, setClueText] = useState('');
  const [clueCount, setClueCount] = useState(1);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const summary = state?.room.status !== 'finished' && state?.room.gamePhase === 'summary' ? state.roundSummary : null;
  const isVictoryState =
    state?.room.status === 'finished' &&
    Boolean(state?.gameResultSummary);

  useCanvasTheme(
    isVictoryState
      ? state?.room.winningTeam ?? null
      : state?.viewer.isTeacher
        ? 'silver'
        : state?.viewer.team === 'blue'
          ? 'blue'
          : state?.viewer.team === 'red'
            ? 'red'
            : null
  );

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.viewer.route === 'lobby') {
      navigate(`/room/${normalizedRoomCode}/lobby`, { replace: true });
    }

    if (state.viewer.route === 'guesser') {
      navigate(`/room/${normalizedRoomCode}/guesser`, { replace: true });
    }
  }, [navigate, normalizedRoomCode, state]);

  useEffect(() => {
    if (!state) {
      return;
    }

    setClueText(state.clue.text ?? '');
    setClueCount(state.clue.count);
  }, [state?.clue.text, state?.clue.count]);

  useEffect(() => {
    if (summary) {
      setIsChatExpanded(false);
    }
  }, [summary]);

  if (isLoading || !state) {
    return <main className="page-shell"><section className="paper-panel"><p>Loading spymaster view…</p></section></main>;
  }

  if (state.room.status === 'finished' && state.gameResultSummary) {
    return (
      <>
        <AppTopBar
          variant="dim"
          rightSlot={
            <GameTopBarInfo
              players={state.players}
              assignments={state.assignments}
              viewerName={state.viewer.name ?? 'Player'}
            />
          }
        />
        <div className="page-shell page-shell--with-topbar">
          <VictoryPage summary={state.gameResultSummary} canControl={false} />
        </div>
      </>
    );
  }

  const spymasterTitle = state.viewer.team ? `${TEAM_LABELS[state.viewer.team]} Spymaster View` : 'Spymaster View';
  const cluePanelState = state.viewer.cluePanelState;
  const isClueLockedForRound = cluePanelState === 'done';
  const viewerTeamStatus = state.viewer.team ? state.teamStatus[state.viewer.team] : null;
  const captainSpymasterName = viewerTeamStatus?.currentSpymasterCaptainName ?? 'Another spymaster';
  const isViewerTeamActive = state.viewer.team !== null && state.viewer.team === state.room.currentTurnTeam;
  const panelHeading =
    cluePanelState === 'open' || cluePanelState === 'done'
      ? 'Send the turn hint'
      : isViewerTeamActive
        ? `${captainSpymasterName} is the captain this round`
        : 'Wait for your team turn';

  function handleClueSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.playerId || !state?.viewer.canEditClue) {
      return;
    }

    actions.emit('clue:update', {
      roomCode: normalizedRoomCode,
      playerId: session.playerId,
      text: clueText,
      count: clueCount
    });
  }

  return (
    <>
      <AppTopBar
        variant="dim"
        rightSlot={
          <GameTopBarInfo
            players={state.players}
            assignments={state.assignments}
            viewerName={state.viewer.name ?? 'Player'}
          />
        }
      />

      <main className="page-shell page-shell--with-topbar game-page-shell spymaster-page">
      <div className={`role-layout role-layout--game ${isChatExpanded ? 'role-layout--chat-expanded' : ''}`}>
        <section className="role-layout__board">
          <div className="game-state-header game-state-header--centered">
            <div className="game-state-header__title">
              <p className="eyebrow">{state.viewer.team ? formatRoleLabel(state.viewer.team, 'spymaster') : 'Spymaster Board'}</p>
              <h1>{spymasterTitle}</h1>
              <p className="supporting-text">
                {summary
                  ? 'The clue cycle is paused while the round summary is on screen.'
                  : 'This board shows the hidden ownership colors, and the clue form sets the live hint and vote count for your team.'}
              </p>
            </div>
            <div className="score-summary-card">
              <div>
                <span>Red Team</span>
                <strong>{state.teamStatus.red.remainingWords}</strong>
              </div>
              <div>
                <span>Blue Team</span>
                <strong>{state.teamStatus.blue.remainingWords}</strong>
              </div>
              <div>
                <span>Current Clue</span>
                <strong>{state.clue.text ?? '...'}</strong>
              </div>
            </div>
          </div>

          <div className="board-shell board-shell--game">
            <BoardGrid
              tiles={state.board}
              variant="play"
              voteDisplayMode="split"
              activeTeam={state.room.currentTurnTeam}
            />
          </div>

          <div className="game-chat-mobile-toggle">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setIsChatExpanded(true)}
            >
              Open Chat
            </button>
          </div>
        </section>

        <aside className={`role-layout__rail role-layout__rail--chat ${isChatExpanded ? 'role-layout__rail--chat-expanded' : ''}`}>
          <section className={`glass-panel game-side-note ${isClueLockedForRound ? 'game-side-note--locked' : ''} ${isChatExpanded ? 'game-side-note--hidden' : ''}`}>
            {isClueLockedForRound ? (
              <div className="game-side-note__lock-overlay" aria-hidden>
                <span>DONE</span>
              </div>
            ) : null}
            <div className="section-heading">
              <p className="eyebrow">Active Clue</p>
              <h3>{panelHeading}</h3>
            </div>
            {cluePanelState === 'open' || cluePanelState === 'done' ? (
              <form className="stack-form" onSubmit={handleClueSubmit}>
                <label>
                  <span>One-word clue</span>
                  <input
                    value={clueText}
                    onChange={(event) => setClueText(event.target.value)}
                    placeholder="Enter Clue Here"
                    maxLength={24}
                    disabled={!state.viewer.canEditClue}
                  />
                </label>
                <label>
                  <span>Choices per guesser</span>
                  <select
                    className="chat-select"
                    value={clueCount}
                    onChange={(event) => setClueCount(Number(event.target.value))}
                    disabled={!state.viewer.canEditClue}
                  >
                    {Array.from({ length: 9 }, (_value, index) => (
                      <option key={index + 1} value={index + 1}>
                        {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button button--primary" type="submit" disabled={!state.viewer.canEditClue}>
                  Update Clue
                </button>
              </form>
            ) : (
              <div className="game-side-note__passive-card">
                <strong>{captainSpymasterName}</strong>
                <p className="supporting-text">
                  {isViewerTeamActive
                    ? `${captainSpymasterName} is the captain spymaster for this round, so only they can enter the clue. You can still use subgroup chat below while they set it up.`
                    : `It is not your team’s turn right now. When ${state.viewer.team ? TEAM_LABELS[state.viewer.team] : 'your team'} is active again, ${captainSpymasterName} will be the captain spymaster unless the rotation has moved on.`}
                </p>
              </div>
            )}
            <p className="supporting-text">
              {summary
                ? 'The board is paused until the teacher continues from the presentation screen.'
                : cluePanelState === 'done'
                ? `The clue and guess count are locked for this round. The teacher can reveal up to ${state.clue.remainingReveals} voted card${state.clue.remainingReveals === 1 ? '' : 's'} before the clue cycle ends.`
                : cluePanelState === 'open'
                  ? 'You are the captain spymaster this round. Submitting the clue locks this panel for the rest of the clue cycle.'
                  : isViewerTeamActive
                    ? 'Only the current captain spymaster can edit the clue during this team turn.'
                    : 'Your key board stays visible, but clue entry only opens when it is your team’s turn and you are the current captain spymaster.'}
            </p>
          </section>

          <ChatPanel
            title={state.viewer.team && state.viewer.role ? formatRoleLabel(state.viewer.team, state.viewer.role) : 'Subgroup'}
            messages={state.chatMessages}
            currentPlayerId={session?.playerId}
            disabled={!session?.playerId || !state.viewer.channelKey}
            expandable
            expanded={isChatExpanded}
            onToggleExpanded={() => setIsChatExpanded((current) => !current)}
            onSend={(message) => {
              if (!session?.playerId) {
                return;
              }

              actions.emit('chat:send', {
                roomCode: normalizedRoomCode,
                playerId: session.playerId,
                message
              });
            }}
          />

          {error ? <p className="error-banner">{error}</p> : null}
        </aside>
      </div>
      {summary ? <RoundSummaryModal summary={summary} variant="player" /> : null}
      </main>
    </>
  );
}
