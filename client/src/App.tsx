import { Navigate, Route, Routes } from 'react-router-dom';
import { GuesserPage } from './pages/GuesserPage';
import { LobbyPage } from './pages/LobbyPage';
import { PresentationPage } from './pages/PresentationPage';
import { SpymasterPage } from './pages/SpymasterPage';
import { StartPage } from './pages/StartPage';
import { StudentJoinPage } from './pages/StudentJoinPage';
import { WordPackPage } from './pages/WordPackPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/join/:roomCode" element={<StudentJoinPage />} />
      <Route path="/room/:roomCode/join" element={<StudentJoinPage />} />
      <Route path="/room/:roomCode/lobby" element={<LobbyPage />} />
      <Route path="/room/:roomCode/wordpacks" element={<WordPackPage />} />
      <Route path="/room/:roomCode/presentation" element={<PresentationPage />} />
      <Route path="/room/:roomCode/guesser" element={<GuesserPage />} />
      <Route path="/room/:roomCode/spymaster" element={<SpymasterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
