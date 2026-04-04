import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppTopBar } from '../components/AppTopBar';
import { StartBoardPreview } from '../components/StartBoardPreview';
import { useCanvasTheme } from '../hooks/useCanvasTheme';
import { joinRoom } from '../services/api';
import { getStoredSession, saveSession } from '../utils/session';

export function StudentJoinPage() {
  useCanvasTheme('silver');
  const navigate = useNavigate();
  const { roomCode = '' } = useParams();
  const normalizedRoomCode = roomCode.toUpperCase();
  const existingSession = getStoredSession(normalizedRoomCode);
  const isReturningStudent = Boolean(existingSession && !existingSession.isTeacher);
  const [studentName, setStudentName] = useState(existingSession?.isTeacher ? '' : existingSession?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleJoinLobby(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const session = await joinRoom(normalizedRoomCode, {
        name: studentName.trim(),
        playerId: existingSession && !existingSession.isTeacher ? existingSession.playerId : undefined
      });
      saveSession(session);
      navigate(`/room/${session.roomCode}/lobby`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to join the room.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AppTopBar
        variant="dim"
      />

      <main className="start-page start-page--with-topbar">
        <section className="start-copy-column start-copy-column--join">
          <h1>Code Names</h1>
          <form onSubmit={handleJoinLobby} className="start-action-form start-action-form--primary start-join-panel">
            <div className="section-heading">
              <p className="eyebrow">Room {normalizedRoomCode}</p>
              <h3>{isReturningStudent ? 'Return to the game' : 'Enter the lobby'}</h3>
            </div>
            {isReturningStudent ? (
              <p className="supporting-text">Use your original name to reclaim your seat if you were disconnected.</p>
            ) : null}
            <label>
              <span>Your name</span>
              <input
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                placeholder="Student name"
                maxLength={48}
              />
            </label>
            <button className="button button--primary" type="submit" disabled={isSubmitting || !studentName.trim()}>
              {isReturningStudent ? 'Return to Game' : 'Enter Lobby'}
            </button>
          </form>

          {error ? <p className="error-banner">{error}</p> : null}
        </section>

        <section className="start-board-column">
          <StartBoardPreview />
        </section>
      </main>
    </>
  );
}
