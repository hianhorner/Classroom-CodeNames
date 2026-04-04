import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppTopBar } from '../components/AppTopBar';
import { StartBoardPreview } from '../components/StartBoardPreview';
import { useCanvasTheme } from '../hooks/useCanvasTheme';
import { createRoom, joinRoom } from '../services/api';
import { getStoredSession, saveSession } from '../utils/session';

export function StartPage() {
  useCanvasTheme('silver');
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentRoomCode, setStudentRoomCode] = useState('');
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  async function handleStartSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingRoom(true);
    setTeacherError(null);

    try {
      const session = await createRoom({ teacherName: teacherName.trim() || 'Teacher' });
      saveSession(session);
      navigate(`/room/${session.roomCode}/lobby`);
    } catch (submitError) {
      setTeacherError(submitError instanceof Error ? submitError.message : 'Unable to create room.');
    } finally {
      setIsCreatingRoom(false);
    }
  }

  async function handleStudentJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedRoomCode = studentRoomCode.trim().toUpperCase();
    const normalizedStudentName = studentName.trim();
    const existingSession = getStoredSession(normalizedRoomCode);

    setIsJoiningRoom(true);
    setStudentError(null);

    try {
      const session = await joinRoom(normalizedRoomCode, {
        name: normalizedStudentName,
        playerId: existingSession && !existingSession.isTeacher ? existingSession.playerId : undefined
      });
      saveSession(session);
      navigate(`/room/${session.roomCode}/lobby`);
    } catch (submitError) {
      setStudentError(submitError instanceof Error ? submitError.message : 'Unable to join the room.');
    } finally {
      setIsJoiningRoom(false);
    }
  }

  return (
    <>
      <AppTopBar
        variant="dim"
      />

      <main className="start-page start-page--with-topbar">
        <section className="start-copy-column">
          <h1>Code Names</h1>
          <div className="start-play-guide">
            <h2>How to Play</h2>
            <ol className="start-play-guide__list">
              <li>Two teams compete to identify their hidden words.</li>
              <li>One player gives a one-word clue that connects multiple words on the board.</li>
              <li>Teammates discuss and select the cards they believe fit the clue.</li>
              <li>Avoid choosing the assassin card.</li>
              <li>The first team to reveal all of their words wins.</li>
            </ol>
          </div>

        </section>

        <section className="start-board-column">
          <section className="start-hero-split">
            <form
              onSubmit={handleStartSession}
              className="start-action-form start-action-form--primary start-action-form--hero start-action-form--teacher"
            >
              <div className="section-heading">
                <h3>Start a Game</h3>
              </div>
              <label>
                <input
                  value={teacherName}
                  onChange={(event) => setTeacherName(event.target.value)}
                  placeholder="Teacher name"
                />
              </label>
              <button className="button button--primary" type="submit" disabled={isCreatingRoom}>
                Start Session
              </button>
              {teacherError ? <p className="error-banner">{teacherError}</p> : null}
            </form>

            <form
              onSubmit={handleStudentJoin}
              className="start-action-form start-action-form--primary start-action-form--hero start-action-form--student"
            >
              <div className="section-heading start-student-heading">
                <h3>Join a classroom</h3>
                <span className="start-student-heading__room-code">Room code</span>
              </div>

              <div className="start-student-entry-grid">
                <label>
                  <input
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    placeholder="Student name"
                    maxLength={48}
                  />
                </label>
                <label>
                  <span className="start-student-entry-grid__room-code-label">Room code</span>
                  <input
                    value={studentRoomCode}
                    onChange={(event) => setStudentRoomCode(event.target.value.toUpperCase())}
                    placeholder="AB12CD"
                    maxLength={12}
                  />
                </label>
              </div>

              <button
                className="button button--primary"
                type="submit"
                disabled={isJoiningRoom || !studentName.trim() || !studentRoomCode.trim()}
              >
                Enter Lobby
              </button>
              {studentError ? <p className="error-banner">{studentError}</p> : null}
            </form>
          </section>

          <StartBoardPreview />
        </section>
      </main>
    </>
  );
}
