export type Team = 'red' | 'blue';
export type Role = 'guesser' | 'spymaster';
export type OwnerColor = Team | 'neutral' | 'assassin';
export type RoomStatus = 'lobby' | 'in_progress' | 'finished';
export type GamePhase = 'lobby' | 'guessing' | 'summary' | 'finished';
export type TimerState = 'idle' | 'running' | 'paused';
export type ViewerRoute = 'start' | 'lobby' | 'presentation' | 'guesser' | 'spymaster';
export type RoomStateView = 'lobby' | 'presentation' | 'player';
export type CluePanelState = 'open' | 'done' | 'inactive';
export type VoteScope = 'active' | 'passive';
export type WordPackSourceType = 'manual' | 'spreadsheet';
export type RoundSummaryReason =
  | 'teacher_ended'
  | 'turn_completed'
  | 'allowance_exhausted'
  | 'wrong_reveal'
  | 'assassin'
  | 'team_completed'
  | 'opponent_completed';
export type ChannelKey =
  | 'red_guessers'
  | 'red_spymasters'
  | 'blue_guessers'
  | 'blue_spymasters';

export interface SessionIdentity {
  roomCode: string;
  playerId: string;
  isTeacher: boolean;
  name: string;
}

export interface PlayerSummary {
  id: string;
  name: string;
  isTeacher: boolean;
  isConnected: boolean;
  joinedAt: string;
}

export interface AssignmentSummary {
  playerId: string;
  team: Team | null;
  role: Role | null;
  captainOrder: number | null;
  isCurrentCaptain: boolean;
  isCurrentSpymasterCaptain: boolean;
}

export interface BoardTileView {
  id: string;
  position: number;
  word: string;
  ownerColor: OwnerColor | null;
  isRevealed: boolean;
  voteCount: number;
  redVoteCount: number;
  blueVoteCount: number;
  isViewerVote: boolean;
  isRevealable: boolean;
}

export interface RoundSummaryReveal {
  tileId: string;
  word: string;
  ownerColor: OwnerColor;
  activeVotesOnTile: number;
  passiveVotesOnTile: number;
}

export interface RoundSummary {
  activeTeam: Team;
  nextTeam: Team | null;
  winningTeam: Team | null;
  clueText: string;
  clueCount: number;
  endReason: RoundSummaryReason;
  outcomeLabel: string;
  outcomeDetail: string;
  wordsRevealed: number;
  activeVoteAccuracy: number | null;
  passiveVoteAccuracy: number | null;
  activeVoterCount: number;
  passiveVoterCount: number;
  revealSequence: RoundSummaryReveal[];
}

export interface GameResultMistakeCounts {
  neutral: number;
  opponent: number;
  assassin: number;
  total: number;
}

export interface GameResultProgress {
  revealed: number;
  total: number;
}

export interface GameResultBestRead {
  turnNumber: number;
  clueText: string | null;
  activeVoteAccuracy: number | null;
  correctReveals: number;
}

export interface GameResultBestGuesser {
  playerId: string;
  playerName: string;
  team: Team;
  activeVoteAccuracy: number | null;
  correctActiveVotes: number;
  totalActiveVotes: number;
}

export interface GameResultRoundHistory {
  turnNumber: number;
  activeTeam: Team;
  clueText: string | null;
  clueCount: number | null;
  endReason: RoundSummaryReason;
  outcomeLabel: string;
  activeVoteAccuracy: number | null;
  passiveVoteAccuracy: number | null;
  activeVoterCount: number;
  passiveVoterCount: number;
  activeVotedWords: string[];
  passiveVotedWords: string[];
  revealSequence: RoundSummaryReveal[];
  correctReveals: number;
  mistakeCount: number;
}

export interface GameResultTeamAccuracyTotals {
  activeVoteAccuracy: number | null;
  passiveVoteAccuracy: number | null;
}

export interface GameResultMostContestedWord {
  word: string;
  totalVotes: number;
  activeVotes: number;
  passiveVotes: number;
}

export interface GameResultSharpestPrediction {
  turnNumber: number;
  team: Team;
  clueText: string | null;
  passiveVoteAccuracy: number | null;
}

export interface GameResultCleanestRound {
  turnNumber: number;
  team: Team;
  clueText: string | null;
  activeVoteAccuracy: number | null;
  correctReveals: number;
}

export interface GameResultSummary {
  winningTeam: Team;
  endReason: RoundSummaryReason;
  outcomeLabel: string;
  outcomeDetail: string;
  winningVoteAccuracy: number | null;
  passiveVoteAccuracy: number | null;
  roundsPlayed: number;
  winningCorrectReveals: number;
  mistakeCounts: GameResultMistakeCounts;
  finalRevealSequence: RoundSummaryReveal[];
  winningTeamProgress: GameResultProgress;
  losingTeamProgress: GameResultProgress;
  roundHistory: GameResultRoundHistory[];
  teamAccuracyTotals: Record<Team, GameResultTeamAccuracyTotals>;
  bestRead: GameResultBestRead | null;
  bestGuesser: GameResultBestGuesser | null;
  mostContestedWord: GameResultMostContestedWord | null;
  sharpestPrediction: GameResultSharpestPrediction | null;
  cleanestRound: GameResultCleanestRound | null;
}

export interface WordPackConfig {
  name: string;
  sourceType: WordPackSourceType;
  randomWords: string[];
  redWords: string[];
  blueWords: string[];
  assassinWord: string | null;
  forcedStartingTeam: Team | null;
}

export interface WordPackSummary {
  id: string;
  name: string;
  sourceType: WordPackSourceType;
  randomWordCount: number;
  redWordCount: number;
  blueWordCount: number;
  hasAssassinWord: boolean;
  forcedStartingTeam: Team | null;
  updatedAt: string;
}

export interface RoomWordPackState {
  selectedPackId: string | null;
  selectedPackName: string | null;
  selectedPackSourceType: WordPackSourceType | null;
  forcedStartingTeam: Team | null;
  usesDefaultPack: boolean;
}

export interface ChatMessageView {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  createdAt: string;
}

export interface TeamStatusSummary {
  remainingWords: number;
  totalWords: number;
  currentCaptainPlayerId: string | null;
  currentCaptainName: string | null;
  currentSpymasterCaptainPlayerId: string | null;
  currentSpymasterCaptainName: string | null;
  guesserCount: number;
  spymasterCount: number;
}

export interface ViewerPermissions {
  canEditAssignments: boolean;
  canStartGame: boolean;
  canReveal: boolean;
  canEndGuessing: boolean;
  canEndTurn: boolean;
  canEndGuessingEarly: boolean;
  canContinueSummary: boolean;
  canVote: boolean;
  canPassiveVote: boolean;
  canControlTimer: boolean;
  canEditClue: boolean;
  showKey: boolean;
}

export interface ViewerState extends ViewerPermissions {
  playerId: string | null;
  name: string | null;
  isTeacher: boolean;
  team: Team | null;
  role: Role | null;
  channelKey: ChannelKey | null;
  isCurrentCaptain: boolean;
  isCurrentSpymasterCaptain: boolean;
  cluePanelState: CluePanelState;
  route: ViewerRoute;
}

export interface RoomViewState {
  room: {
    roomCode: string;
    status: RoomStatus;
    gamePhase: GamePhase;
    currentTurnTeam: Team | null;
    turnNumber: number;
    winningTeam: Team | null;
  };
  timer: {
    enabled: boolean;
    seconds: number;
    remainingSeconds: number;
    state: TimerState;
  };
  clue: {
    text: string | null;
    count: number;
    remainingReveals: number;
    isActive: boolean;
  };
  wordPack: RoomWordPackState;
  viewer: ViewerState;
  players: PlayerSummary[];
  assignments: AssignmentSummary[];
  board: BoardTileView[];
  teamStatus: Record<Team, TeamStatusSummary>;
  chatMessages: ChatMessageView[];
  roundSummary: RoundSummary | null;
  gameResultSummary: GameResultSummary | null;
  joinLink: string;
  presentationPath: string;
}

export interface SaveManualWordPackRequest {
  playerId: string;
  name: string;
  words: string;
}

export interface ApplyManualWordPackRequest {
  playerId: string;
  name: string;
  words: string;
}

export interface ApplySavedWordPackRequest {
  playerId: string;
}

export interface DeleteSavedWordPackRequest {
  playerId: string;
}

export interface CreateRoomRequest {
  teacherName: string;
}

export interface CreateRoomResponse extends SessionIdentity {}

export interface JoinRoomRequest {
  name: string;
  playerId?: string;
}

export interface JoinRoomResponse extends SessionIdentity {}

export interface GetRoomStateRequest {
  playerId?: string;
  view?: RoomStateView;
}

export interface AssignmentUpdateInput {
  playerId: string;
  team: Team | null;
  role: Role | null;
  captainOrder?: number | null;
}

export interface UpdateAssignmentsRequest {
  playerId: string;
  assignments: AssignmentUpdateInput[];
}

export interface StartGameRequest {
  playerId: string;
}

export interface UpdateTimerRequest {
  playerId: string;
  enabled: boolean;
  seconds: number;
}

export interface SocketJoinPayload {
  roomCode: string;
  playerId?: string;
  view: RoomStateView;
}

export interface VotePayload {
  roomCode: string;
  playerId: string;
  tileId: string;
}

export interface RevealTilePayload {
  roomCode: string;
  playerId: string;
  tileId: string;
}

export interface AdvanceTurnPayload {
  roomCode: string;
  playerId: string;
}

export interface GameControlPayload {
  roomCode: string;
  playerId: string;
}

export interface EndGuessingEarlyPayload {
  roomCode: string;
  playerId: string;
}

export interface SendChatPayload {
  roomCode: string;
  playerId: string;
  message: string;
}

export interface TimerControlPayload {
  roomCode: string;
  playerId: string;
}

export interface ClueUpdatePayload {
  roomCode: string;
  playerId: string;
  text: string;
  count: number;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomViewState) => void;
  'server:error': (message: string) => void;
}

export interface ClientToServerEvents {
  'room:join': (payload: SocketJoinPayload) => void;
  'vote:cast': (payload: VotePayload) => void;
  'vote:remove': (payload: VotePayload) => void;
  'tile:reveal': (payload: RevealTilePayload) => void;
  'turn:advance': (payload: AdvanceTurnPayload) => void;
  'turn:end-early': (payload: EndGuessingEarlyPayload) => void;
  'game:rematch': (payload: GameControlPayload) => void;
  'game:start-over': (payload: GameControlPayload) => void;
  'chat:send': (payload: SendChatPayload) => void;
  'clue:update': (payload: ClueUpdatePayload) => void;
  'timer:start': (payload: TimerControlPayload) => void;
  'timer:pause': (payload: TimerControlPayload) => void;
  'timer:reset': (payload: TimerControlPayload) => void;
}
