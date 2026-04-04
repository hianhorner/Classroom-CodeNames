import {
  formatRoleLabel,
  type AssignmentSummary,
  type AssignmentUpdateInput,
  type PlayerSummary,
  type Role,
  type Team
} from '@classroom-codenames/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppTopBar } from '../components/AppTopBar';
import { WAITING_QUOTES } from '../constants/waitingQuotes';
import { useCanvasTheme } from '../hooks/useCanvasTheme';
import { useRoomState } from '../hooks/useRoomState';
import { RoomCodePanel } from '../components/RoomCodePanel';
import { TeamAssignmentBoard } from '../components/TeamAssignmentBoard';

function LobbyLoading() {
  return <main className="page-shell"><section className="paper-panel"><p>Loading room…</p></section></main>;
}

function getRoleInstructions(team: Team, role: Role) {
  if (role === 'guesser') {
    return [
      `You are on the ${team} guessing team. Listen to your spymaster's clue, talk through the options, and vote for the cards that fit best.`,
      'When the game starts, you can mark cards on your private board. The teacher reveals voted cards manually, and your guesser captain rotation is still shown for classroom turn-taking.'
    ];
  }

  return [
    `You are on the ${team} spymaster team. You will see the hidden key and help guide your team away from the wrong cards and the assassin.`,
    'When it is your team’s turn, only the current captain spymaster can enter the one-word clue and choose how many guesses each guesser is allowed to make.'
  ];
}

function getStartGameBlockers(players: PlayerSummary[], assignments: AssignmentSummary[]): string[] {
  const blockers: string[] = [];
  const assignmentsByPlayerId = new Map(assignments.map((assignment) => [assignment.playerId, assignment]));
  const connectedStudentIds = new Set(
    players.filter((player) => !player.isTeacher && player.isConnected).map((player) => player.id)
  );
  const roleCounts: Record<Team, Record<Role, number>> = {
    red: { guesser: 0, spymaster: 0 },
    blue: { guesser: 0, spymaster: 0 }
  };

  assignments.forEach((assignment) => {
    if (!assignment.team || !assignment.role || !connectedStudentIds.has(assignment.playerId)) {
      return;
    }

    roleCounts[assignment.team][assignment.role] += 1;
  });

  (['red', 'blue'] as Team[]).forEach((team) => {
    const teamLabel = team === 'red' ? 'Red' : 'Blue';

    if (!roleCounts[team].guesser) {
      blockers.push(`Add at least one ${teamLabel} guesser.`);
    }

    if (!roleCounts[team].spymaster) {
      blockers.push(`Add at least one ${teamLabel} spymaster.`);
    }
  });

  const unassignedStudents = players.filter((player) => {
    if (player.isTeacher || !player.isConnected) {
      return false;
    }

    const assignment = assignmentsByPlayerId.get(player.id);
    return !assignment?.team || !assignment.role;
  });

  if (unassignedStudents.length) {
    blockers.push(
      `${unassignedStudents.length} student${unassignedStudents.length === 1 ? '' : 's'} still need team roles.`
    );
  }

  return blockers;
}

function StudentWaitingScreen({
  error,
  team,
  role
}: {
  error: string | null;
  team: Team | null;
  role: Role | null;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [frontQuoteIndex, setFrontQuoteIndex] = useState(0);
  const [backQuoteIndex, setBackQuoteIndex] = useState(WAITING_QUOTES.length > 1 ? 1 : 0);
  const [surgeTone, setSurgeTone] = useState<'red' | 'blue' | null>(null);
  const [surgePulseId, setSurgePulseId] = useState(0);
  const [settledTone, setSettledTone] = useState<'red' | 'blue' | null>(null);
  const isFlippedRef = useRef(false);
  const nextQuoteIndexRef = useRef(2);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextQuoteIndex = nextQuoteIndexRef.current % WAITING_QUOTES.length;
      nextQuoteIndexRef.current += 1;

      if (isFlippedRef.current) {
        setFrontQuoteIndex(nextQuoteIndex);
      } else {
        setBackQuoteIndex(nextQuoteIndex);
      }

      isFlippedRef.current = !isFlippedRef.current;
      setIsFlipped(isFlippedRef.current);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (team && role) {
      setSurgeTone(team);
      setSurgePulseId((currentPulseId) => currentPulseId + 1);
      setSettledTone(team);
      return;
    }

    setSettledTone(null);
    const intervalId = window.setInterval(() => {
      setSurgeTone((currentTone) => (currentTone === 'red' ? 'blue' : 'red'));
      setSurgePulseId((currentPulseId) => currentPulseId + 1);
    }, 7600);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [team, role]);

  const assignedRoleLabel = team && role ? formatRoleLabel(team, role) : null;
  const roleInstructions = team && role ? getRoleInstructions(team, role) : [];

  return (
    <main className="student-waiting-screen">
      {settledTone ? (
        <div
          className={`student-waiting-screen__settled student-waiting-screen__settled--${settledTone}`}
          aria-hidden
        />
      ) : null}

      {surgeTone ? (
        <div
          key={`${surgeTone}-${surgePulseId}`}
          className={`student-waiting-screen__surge student-waiting-screen__surge--${surgeTone}`}
          aria-hidden
        />
      ) : null}

      <section className="student-waiting-screen__content">
        {assignedRoleLabel ? (
          <>
            <p className="student-waiting-screen__eyebrow">You have been assigned as</p>
            <h1>{assignedRoleLabel}</h1>
            <div className="student-waiting-screen__instructions">
              {roleInstructions.map((instruction) => (
                <p key={instruction}>{instruction}</p>
              ))}
            </div>
          </>
        ) : (
          <h1>Waiting for the teacher to do stuff.</h1>
        )}

        <div className={`waiting-quote-card ${isFlipped ? 'waiting-quote-card--flipped' : ''}`}>
          <div className="waiting-quote-card__inner">
            <article className="waiting-quote-card__face waiting-quote-card__face--front">
              <p>{WAITING_QUOTES[frontQuoteIndex]}</p>
            </article>
            <article className="waiting-quote-card__face waiting-quote-card__face--back">
              <p>{WAITING_QUOTES[backQuoteIndex]}</p>
            </article>
          </div>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}
      </section>
    </main>
  );
}

export function LobbyPage() {
  const navigate = useNavigate();
  const { roomCode = '' } = useParams();
  const normalizedRoomCode = roomCode.toUpperCase();
  const { state, session, isLoading, error, actions } = useRoomState(normalizedRoomCode, 'lobby');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [timerMessage, setTimerMessage] = useState<string | null>(null);

  useCanvasTheme(
    state?.viewer.isTeacher || state?.room.status === 'lobby'
      ? 'silver'
      : state?.viewer.team === 'blue'
        ? 'blue'
        : state?.viewer.team === 'red'
          ? 'red'
          : 'silver'
  );

  useEffect(() => {
    if (!state) {
      return;
    }

    setTimerEnabled(state.timer.enabled);
    setTimerSeconds(state.timer.seconds);
  }, [state]);

  useEffect(() => {
    if (!state || state.viewer.isTeacher || state.room.status === 'lobby') {
      return;
    }

    navigate(`/room/${normalizedRoomCode}/${state.viewer.route}`, { replace: true });
  }, [navigate, normalizedRoomCode, state]);

  if (isLoading || !state) {
    return <LobbyLoading />;
  }

  async function handleSaveAssignments(assignments: AssignmentUpdateInput[]) {
    if (!session?.playerId) {
      return;
    }

    await actions.saveAssignments({
      playerId: session.playerId,
      assignments
    });
  }

  async function handleSaveTimer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.playerId) {
      return;
    }

    try {
      await actions.saveTimer({
        playerId: session.playerId,
        enabled: timerEnabled,
        seconds: timerSeconds
      });
      setTimerMessage('Timer settings saved.');
    } catch (saveError) {
      setTimerMessage(saveError instanceof Error ? saveError.message : 'Unable to save timer settings.');
    }
  }

  async function handleStartGame() {
    try {
      await actions.beginGame();
      navigate(`/room/${normalizedRoomCode}/presentation`);
    } catch (startError) {
      setTimerMessage(startError instanceof Error ? startError.message : 'Unable to start the game.');
    }
  }

  if (!state.viewer.isTeacher) {
    return <StudentWaitingScreen error={error} team={state.viewer.team} role={state.viewer.role} />;
  }

  const activeLobbyPlayers = state.players.filter((player) => player.isTeacher || player.isConnected);
  const startGameBlockers = getStartGameBlockers(state.players, state.assignments);
  const startGameBlockersText = startGameBlockers.length ? `Can't start yet: ${startGameBlockers.join(' ')}` : null;

  return (
    <>
      <AppTopBar
        variant="surface"
        rightSlot={<div className="app-topbar__profile">{state.viewer.name ?? 'Player'}</div>}
      />

      <main className="page-shell page-shell--lobby page-shell--with-topbar">
        <header className="page-header page-header--centered">
          <div>
            <h1>Code Names Lobby</h1>
            <p className="supporting-text">
              {state.wordPack.usesDefaultPack
                ? 'Using the default word bank right now.'
                : `Using "${state.wordPack.selectedPackName ?? 'Custom word pack'}" for the next game.`}
            </p>
          </div>
          <div className="page-header__actions page-header__actions--centered">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => navigate(`/room/${normalizedRoomCode}/wordpacks`)}
            >
              Wordpack
            </button>
            <div className="start-game-gate">
              <button
                className="button button--primary"
                type="button"
                onClick={handleStartGame}
                disabled={startGameBlockers.length > 0}
              >
                Start Game
              </button>
              {startGameBlockersText ? <p className="start-game-gate__reason">{startGameBlockersText}</p> : null}
            </div>
          </div>
        </header>

        <div className="page-grid page-grid--lobby">
          <div className="page-grid__main">
            <TeamAssignmentBoard players={activeLobbyPlayers} assignments={state.assignments} onSave={handleSaveAssignments} />
          </div>
          <aside className="page-grid__rail">
            <RoomCodePanel
              roomCode={state.room.roomCode}
              joinLink={state.joinLink}
            />

            <section className="paper-panel lobby-timer-panel">
              <div className="section-heading">
                <p className="eyebrow">Timer Setup</p>
                <h3>Optional countdown</h3>
              </div>
              <form className="stack-form" onSubmit={handleSaveTimer}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={timerEnabled}
                    onChange={(event) => setTimerEnabled(event.target.checked)}
                  />
                  <span>Enable timer</span>
                </label>
                <label>
                  <span>Duration in seconds</span>
                  <input
                    type="number"
                    min={30}
                    max={900}
                    step={15}
                    value={timerSeconds}
                    onChange={(event) => setTimerSeconds(Number(event.target.value))}
                  />
                </label>
                <button className="button button--primary" type="submit">
                  Save Timer Settings
                </button>
              </form>
              {timerMessage ? <p className="supporting-text">{timerMessage}</p> : null}
            </section>
            {error ? <p className="error-banner">{error}</p> : null}
          </aside>
        </div>
      </main>
    </>
  );
}
