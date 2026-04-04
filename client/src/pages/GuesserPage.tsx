import { formatRoleLabel } from '@classroom-codenames/shared';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppTopBar } from '../components/AppTopBar';
import { BoardGrid } from '../components/BoardGrid';
import { ChatPanel } from '../components/ChatPanel';
import { GameTopBarInfo } from '../components/GameTopBarInfo';
import { RoundSummaryModal } from '../components/RoundSummaryModal';
import { VictoryPage } from '../components/VictoryPage';
import { useCanvasTheme } from '../hooks/useCanvasTheme';
import { useRoomState } from '../hooks/useRoomState';

export function GuesserPage() {
  const navigate = useNavigate();
  const { roomCode = '' } = useParams();
  const normalizedRoomCode = roomCode.toUpperCase();
  const { state, session, isLoading, error, actions } = useRoomState(normalizedRoomCode, 'player');
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const isVictoryState =
    state?.room.status === 'finished' &&
    Boolean(state.gameResultSummary);

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

  const selectedVoteTiles = state?.board.filter((tile) => tile.isViewerVote) ?? [];
  const activeVoteLimit = Math.max(1, state?.clue.count ?? 1);
  const remainingVotes = Math.max(0, activeVoteLimit - selectedVoteTiles.length);
  const isPredictionMode = Boolean(state?.viewer.canPassiveVote);
  const canAnyVote = Boolean(state?.viewer.canVote || state?.viewer.canPassiveVote);
  const summary = state?.room.status !== 'finished' && state?.room.gamePhase === 'summary' ? state.roundSummary : null;

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.viewer.route === 'lobby') {
      navigate(`/room/${normalizedRoomCode}/lobby`, { replace: true });
    }

    if (state.viewer.route === 'spymaster') {
      navigate(`/room/${normalizedRoomCode}/spymaster`, { replace: true });
    }
  }, [navigate, normalizedRoomCode, state]);

  useEffect(() => {
    if (summary) {
      setIsChatExpanded(false);
    }
  }, [summary]);

  if (isLoading || !state) {
    return <main className="page-shell"><section className="paper-panel"><p>Loading team board…</p></section></main>;
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

  function handleTileClick(tileId: string) {
    if (!session?.playerId || !state || !canAnyVote) {
      return;
    }

    const tile = state.board.find((entry) => entry.id === tileId);

    if (!tile) {
      return;
    }

    actions.emit(tile.isViewerVote ? 'vote:remove' : 'vote:cast', {
      roomCode: normalizedRoomCode,
      playerId: session.playerId,
      tileId
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

      <main className="page-shell page-shell--with-topbar game-page-shell guesser-page">
      <div className={`role-layout role-layout--game ${isChatExpanded ? 'role-layout--chat-expanded' : ''}`}>
        <section className="role-layout__board">
          <div className="game-state-header">
            <div>
              <p className="eyebrow">{state.viewer.team ? formatRoleLabel(state.viewer.team, 'guesser') : 'Guesser Board'}</p>
              <h1>Voting Round</h1>
              <p className="supporting-text">
                {summary
                  ? 'The clue cycle is paused while the round summary is on screen.'
                  : state.clue.text
                  ? `Clue: "${state.clue.text}" with ${state.clue.count} choice${state.clue.count === 1 ? '' : 's'} per guesser and ${state.clue.remainingReveals} reveal${state.clue.remainingReveals === 1 ? '' : 's'} left this clue cycle.`
                  : state.viewer.canVote
                    ? 'Waiting for your spymaster to submit a clue for this turn.'
                    : isPredictionMode
                      ? 'The other team is active. Your team can place passive prediction votes that stay separate from the live reveal votes.'
                      : 'This board stays visible, but only the active team can vote right now.'}
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
                <span>{isPredictionMode ? 'Prediction Votes Left' : 'Your Votes Left'}</span>
                <strong>{remainingVotes}</strong>
              </div>
              <div>
                <span>Reveals Left</span>
                <strong>{state.clue.remainingReveals}</strong>
              </div>
            </div>
          </div>

          <div className="board-shell board-shell--game">
            <BoardGrid
              tiles={state.board}
              interactive={canAnyVote}
              variant="play"
              voteDisplayMode="split"
              activeTeam={state.room.currentTurnTeam}
              onTileClick={handleTileClick}
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

          <div className="game-action-row">
            <div className="info-pill">
              Captain: {state.viewer.team ? state.teamStatus[state.viewer.team].currentCaptainName ?? 'Waiting' : 'Waiting'}
            </div>
            <div className="info-pill">
              {selectedVoteTiles.length} / {activeVoteLimit} {isPredictionMode ? 'predictions' : 'votes'} selected
            </div>
            <div className="info-pill">
              {summary
                ? 'Round summary in progress.'
                : state.clue.isActive
                  ? isPredictionMode
                    ? 'Your passive team tallies are private until the summary.'
                    : 'Teacher reveals voted cards in any order.'
                  : 'Waiting for the next active clue cycle.'}
            </div>
          </div>
        </section>

        <aside className={`role-layout__rail role-layout__rail--chat ${isChatExpanded ? 'role-layout__rail--chat-expanded' : ''}`}>
          <section className={`glass-panel game-side-note ${isChatExpanded ? 'game-side-note--hidden' : ''}`}>
            <div className="section-heading">
              <p className="eyebrow">Team Status</p>
              <h3>
                {summary
                  ? 'Summary in progress'
                  : state.clue.isActive
                    ? isPredictionMode
                      ? 'Predict the other team'
                      : 'Discuss and vote'
                    : 'Waiting for the next clue'}
              </h3>
            </div>
            <p className="supporting-text">
              {summary
                ? 'The board is paused until the teacher continues from the presentation screen.'
                : state.viewer.canVote
                ? `Each guesser can keep up to ${activeVoteLimit} active vote${activeVoteLimit === 1 ? '' : 's'} for this clue. The teacher can reveal any card that currently has votes, and correct reveals keep this same clue going until the reveal count runs out.`
                : isPredictionMode
                  ? `You can place up to ${activeVoteLimit} passive prediction vote${activeVoteLimit === 1 ? '' : 's'} while the other team is active. These votes never affect the reveal, but your team can see its own prediction tallies in real time.`
                : state.clue.isActive
                  ? 'The clue is live, but this is not your team’s active turn. Watch the board and wait for your next cycle.'
                  : 'This is not your team’s active turn, so your board is view-only right now.'}
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
