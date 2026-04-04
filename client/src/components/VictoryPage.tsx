import { useEffect, useState, type CSSProperties } from 'react';

import { TEAM_LABELS, type GameResultSummary, type Team } from '@classroom-codenames/shared';

type VictoryPageProps = {
  summary: GameResultSummary;
  canControl: boolean;
  onRematch?: () => void;
  onStartOver?: () => void;
};

type ConfettiPiece = {
  id: string;
  color: string;
  left: string;
  width: string;
  height: string;
  opacity: number;
  radius: string;
  style: CSSProperties;
};

type TacoDrop = {
  id: string;
  left: string;
  opacity: number;
  style: CSSProperties;
};

const CONFETTI_COLORS = ['#f8efe4', '#e3b65e', '#cf6b5e', '#5e84d9', '#6ea866'];
const CONFETTI_PIECES_PER_SIDE = 24;
const CONFETTI_BURST_DELAY_MS = 1600;
const TACO_INTERVAL_MS = 2400;
const TACO_RAIN_MULTIPLIER = 3;
const MAX_TACOS = 6 * TACO_RAIN_MULTIPLIER;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number) {
  return Math.floor(randomRange(min, max + 1));
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function createConfettiPieces() {
  return [12, 88].flatMap((origin, sideIndex) =>
    Array.from({ length: CONFETTI_PIECES_PER_SIDE }, (_, pieceIndex) => {
      const launchX = sideIndex === 0 ? randomRange(-24, 144) : randomRange(-144, 24);
      const endX = launchX + randomRange(-120, 120);
      const rise = randomRange(180, 320);
      const fall = randomRange(340, 480);
      const duration = randomRange(1900, 2700);
      const delay = randomRange(0, 140);
      const width = randomRange(6, 14);
      const height = randomRange(8, 18);
      const rotation = randomRange(-260, 260);

      return {
        id: `${sideIndex}-${pieceIndex}-${Date.now()}-${Math.round(Math.random() * 10000)}`,
        color: CONFETTI_COLORS[randomInt(0, CONFETTI_COLORS.length - 1)],
        left: `${origin + randomRange(-4, 4)}%`,
        width: `${width}px`,
        height: `${height}px`,
        opacity: randomRange(0.72, 1),
        radius: Math.random() > 0.65 ? '999px' : `${randomRange(1.5, 4)}px`,
        style: {
          '--confetti-dx': `${launchX}px`,
          '--confetti-end-x': `${endX}px`,
          '--confetti-rise': `${rise}px`,
          '--confetti-fall': `${fall}px`,
          '--confetti-rotation': `${rotation}deg`,
          animationDelay: `${delay}ms`,
          animationDuration: `${duration}ms`,
        } as CSSProperties,
      };
    }),
  );
}

function createTacoDrop() {
  const duration = randomRange(7600, 10400);
  const delay = randomRange(0, 260);
  const scale = randomRange(0.76, 1.14);
  const drift = randomRange(-72, 72);
  const rotation = randomRange(-26, 26);

  return {
    id: `taco-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    left: `${randomRange(4, 92)}%`,
    opacity: randomRange(0.18, 0.34),
    style: {
      '--taco-drift': `${drift}px`,
      '--taco-rotation': `${rotation}deg`,
      '--taco-scale': `${scale}`,
      animationDelay: `${delay}ms`,
      animationDuration: `${duration}ms`,
    } as CSSProperties,
  };
}

function TacoPixelArt() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden focusable="false" shapeRendering="crispEdges">
      <rect x="4" y="11" width="12" height="1" fill="#7b4b28" />
      <rect x="3" y="12" width="14" height="1" fill="#e1b267" />
      <rect x="3" y="13" width="14" height="1" fill="#f2ca77" />
      <rect x="3" y="14" width="14" height="1" fill="#d59c4d" />
      <rect x="4" y="15" width="12" height="1" fill="#bf863f" />
      <rect x="5" y="9" width="2" height="2" fill="#66a550" />
      <rect x="8" y="8" width="2" height="2" fill="#e34f4f" />
      <rect x="10" y="9" width="3" height="2" fill="#6b3e24" />
      <rect x="13" y="8" width="2" height="2" fill="#f0dc66" />
      <rect x="7" y="10" width="1" height="1" fill="#66a550" />
      <rect x="12" y="10" width="1" height="1" fill="#e34f4f" />
      <rect x="9" y="10" width="1" height="1" fill="#f0dc66" />
    </svg>
  );
}

function formatAccuracy(value: number | null) {
  return value === null ? 'N/A' : `${value}%`;
}

function formatReason(reason: GameResultSummary['endReason']) {
  switch (reason) {
    case 'assassin':
      return 'Assassin';
    case 'team_completed':
      return 'Board Cleared';
    case 'opponent_completed':
      return 'Opponent Cleared';
    case 'teacher_ended':
      return 'Teacher Ended Early';
    case 'turn_completed':
      return 'Round Complete';
    case 'allowance_exhausted':
      return 'Allowance Used';
    case 'wrong_reveal':
      return 'Wrong Reveal';
  }
}

function getRevealTone(team: Team, ownerColor: string) {
  if (ownerColor === 'assassin') {
    return 'victory-page__reveal--assassin';
  }

  if (ownerColor === 'neutral') {
    return 'victory-page__reveal--neutral';
  }

  return ownerColor === team ? 'victory-page__reveal--winning' : 'victory-page__reveal--mistake';
}

export function VictoryPage({ summary, canControl, onRematch, onStartOver }: VictoryPageProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [tacoDrops, setTacoDrops] = useState<TacoDrop[]>([]);
  const winningTeamLabel = TEAM_LABELS[summary.winningTeam];
  const losingTeamLabel = TEAM_LABELS[summary.winningTeam === 'red' ? 'blue' : 'red'];

  useEffect(() => {
    setConfettiPieces([]);
    setTacoDrops([]);

    if (prefersReducedMotion || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    const timeoutIds: number[] = [];
    let tacoIntervalId: number | undefined;

    const scheduleTimeout = (callback: () => void, delayMs: number) => {
      const timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          callback();
        }
      }, delayMs);
      timeoutIds.push(timeoutId);
    };

    scheduleTimeout(() => {
      setConfettiPieces(createConfettiPieces());
      scheduleTimeout(() => setConfettiPieces([]), 3200);
    }, CONFETTI_BURST_DELAY_MS);

    const spawnTacoBatch = () => {
      const batchSize = (Math.random() > 0.55 ? 2 : 1) * TACO_RAIN_MULTIPLIER;
      const nextDrops = Array.from({ length: batchSize }, createTacoDrop);

      setTacoDrops((current) => [...current, ...nextDrops].slice(-MAX_TACOS));

      nextDrops.forEach((drop) => {
        const durationMs = Number.parseFloat(`${drop.style.animationDuration ?? 0}`);
        const delayMs = Number.parseFloat(`${drop.style.animationDelay ?? 0}`);
        scheduleTimeout(() => {
          setTacoDrops((current) => current.filter((item) => item.id !== drop.id));
        }, durationMs + delayMs + 350);
      });
    };

    spawnTacoBatch();
    tacoIntervalId = window.setInterval(spawnTacoBatch, TACO_INTERVAL_MS);

    return () => {
      cancelled = true;
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if (tacoIntervalId !== undefined) {
        window.clearInterval(tacoIntervalId);
      }
    };
  }, [prefersReducedMotion, summary.winningTeam, summary.roundsPlayed, summary.outcomeDetail]);

  return (
    <main className={`victory-page victory-page--${summary.winningTeam}`}>
      <div className="victory-page__taco-layer" aria-hidden>
        {tacoDrops.map((drop) => (
          <div
            key={drop.id}
            className="victory-page__taco-drop"
            style={{
              left: drop.left,
              opacity: drop.opacity,
              ...drop.style,
            }}
          >
            <TacoPixelArt />
          </div>
        ))}
      </div>
      <div className="victory-page__graffiti victory-page__graffiti--one" aria-hidden />
      <div className="victory-page__graffiti victory-page__graffiti--two" aria-hidden />
      <div className="victory-page__confetti-layer" aria-hidden>
        {confettiPieces.map((piece) => (
          <span
            key={piece.id}
            className="victory-page__confetti-piece"
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              opacity: piece.opacity,
              borderRadius: piece.radius,
              background: piece.color,
              ...piece.style,
            }}
          />
        ))}
      </div>
      <section className="paper-panel victory-page__card">
        <header className="victory-page__header">
          <p className="eyebrow">Game Over</p>
          <h1>{winningTeamLabel} Team Wins</h1>
          <p className="supporting-text">{summary.outcomeDetail}</p>
          <div className="victory-page__headline-pills">
            <span className="victory-page__pill">{formatReason(summary.endReason)}</span>
            <span className="victory-page__pill">{summary.roundsPlayed} rounds</span>
          </div>
        </header>

        <section className="victory-page__headline-grid">
          <article className="victory-page__stat-card">
            <span>Winning Vote Accuracy</span>
            <strong>{formatAccuracy(summary.winningVoteAccuracy)}</strong>
          </article>
          <article className="victory-page__stat-card">
            <span>Passive Vote Accuracy</span>
            <strong>{formatAccuracy(summary.passiveVoteAccuracy)}</strong>
          </article>
          <article className="victory-page__stat-card">
            <span>Correct Reveals</span>
            <strong>{summary.winningCorrectReveals}</strong>
          </article>
          <article className="victory-page__stat-card">
            <span>Mistakes</span>
            <strong>{summary.mistakeCounts.total}</strong>
          </article>
        </section>

        <section className="victory-page__progress-strip">
          <article className="victory-page__progress-card">
            <span>{winningTeamLabel} Progress</span>
            <strong>
              {summary.winningTeamProgress.revealed} / {summary.winningTeamProgress.total}
            </strong>
          </article>
          <article className="victory-page__progress-card">
            <span>{losingTeamLabel} Progress</span>
            <strong>
              {summary.losingTeamProgress.revealed} / {summary.losingTeamProgress.total}
            </strong>
          </article>
        </section>

        <section className="victory-page__team-accuracy">
          <span>Overall Team Accuracy</span>
          <div className="victory-page__team-accuracy-grid">
            <article className="victory-page__detail-card">
              <span>Red Active</span>
              <strong>{formatAccuracy(summary.teamAccuracyTotals.red.activeVoteAccuracy)}</strong>
            </article>
            <article className="victory-page__detail-card">
              <span>Red Passive</span>
              <strong>{formatAccuracy(summary.teamAccuracyTotals.red.passiveVoteAccuracy)}</strong>
            </article>
            <article className="victory-page__detail-card">
              <span>Blue Active</span>
              <strong>{formatAccuracy(summary.teamAccuracyTotals.blue.activeVoteAccuracy)}</strong>
            </article>
            <article className="victory-page__detail-card">
              <span>Blue Passive</span>
              <strong>{formatAccuracy(summary.teamAccuracyTotals.blue.passiveVoteAccuracy)}</strong>
            </article>
          </div>
        </section>

        <section className="victory-page__detail-grid">
          <article className="victory-page__detail-card">
            <span>Best Read</span>
            {summary.bestRead ? (
              <>
                <strong>{summary.bestRead.clueText ? `"${summary.bestRead.clueText}"` : `Turn ${summary.bestRead.turnNumber}`}</strong>
                <p className="supporting-text">
                  {formatAccuracy(summary.bestRead.activeVoteAccuracy)} with {summary.bestRead.correctReveals} correct reveal
                  {summary.bestRead.correctReveals === 1 ? '' : 's'}.
                </p>
              </>
            ) : (
              <p className="supporting-text">The final turn recap carries the story this time.</p>
            )}
          </article>

          <article className="victory-page__detail-card">
            <span>Mistake Breakdown</span>
            <strong>
              {summary.mistakeCounts.neutral} neutral / {summary.mistakeCounts.opponent} opponent / {summary.mistakeCounts.assassin} assassin
            </strong>
            <p className="supporting-text">These were the off-target reveals made during the winning team’s clue cycles.</p>
          </article>
        </section>

        <section className="victory-page__detail-grid">
          <article className="victory-page__detail-card">
            <span>Best Guesser</span>
            {summary.bestGuesser ? (
              <>
                <strong>
                  {summary.bestGuesser.playerName} · {TEAM_LABELS[summary.bestGuesser.team]}
                </strong>
                <p className="supporting-text">
                  {formatAccuracy(summary.bestGuesser.activeVoteAccuracy)} with {summary.bestGuesser.correctActiveVotes} correct out of{' '}
                  {summary.bestGuesser.totalActiveVotes} active votes.
                </p>
              </>
            ) : (
              <p className="supporting-text">No guesser MVP could be determined from this game’s active votes.</p>
            )}
          </article>

          <article className="victory-page__detail-card">
            <span>Most Contested Word</span>
            {summary.mostContestedWord ? (
              <>
                <strong>{summary.mostContestedWord.word}</strong>
                <p className="supporting-text">
                  {summary.mostContestedWord.totalVotes} total votes ({summary.mostContestedWord.activeVotes} active /{' '}
                  {summary.mostContestedWord.passiveVotes} passive).
                </p>
              </>
            ) : (
              <p className="supporting-text">No contested word stood out this time.</p>
            )}
          </article>

          <article className="victory-page__detail-card">
            <span>Sharpest Prediction</span>
            {summary.sharpestPrediction ? (
              <>
                <strong>
                  {TEAM_LABELS[summary.sharpestPrediction.team]} · Turn {summary.sharpestPrediction.turnNumber}
                </strong>
                <p className="supporting-text">
                  {summary.sharpestPrediction.clueText ? `"${summary.sharpestPrediction.clueText}"` : 'No clue label'} at{' '}
                  {formatAccuracy(summary.sharpestPrediction.passiveVoteAccuracy)} passive accuracy.
                </p>
              </>
            ) : (
              <p className="supporting-text">Passive predictions stayed quiet in this game.</p>
            )}
          </article>

          <article className="victory-page__detail-card">
            <span>Cleanest Round</span>
            {summary.cleanestRound ? (
              <>
                <strong>
                  {TEAM_LABELS[summary.cleanestRound.team]} · Turn {summary.cleanestRound.turnNumber}
                </strong>
                <p className="supporting-text">
                  {summary.cleanestRound.clueText ? `"${summary.cleanestRound.clueText}"` : 'No clue label'} with{' '}
                  {formatAccuracy(summary.cleanestRound.activeVoteAccuracy)} active accuracy and {summary.cleanestRound.correctReveals}{' '}
                  correct reveal{summary.cleanestRound.correctReveals === 1 ? '' : 's'}.
                </p>
              </>
            ) : (
              <p className="supporting-text">No zero-mistake round stood above the rest this game.</p>
            )}
          </article>
        </section>

        <section className="victory-page__reveals">
          <span>Final Turn Recap</span>
          {summary.finalRevealSequence.length ? (
            <div className="victory-page__reveal-list">
              {summary.finalRevealSequence.map((reveal) => (
                <span
                  key={`${reveal.tileId}-${reveal.word}`}
                  className={`victory-page__reveal ${getRevealTone(summary.winningTeam, reveal.ownerColor)}`}
                >
                  {reveal.word}
                </span>
              ))}
            </div>
          ) : (
            <p className="supporting-text">No reveal sequence was captured for the final turn.</p>
          )}
        </section>

        <section className="victory-page__rounds">
          <span>Round by Round</span>
          <div className="victory-page__rounds-grid">
            {summary.roundHistory.map((round) => (
              <article key={round.turnNumber} className="victory-page__round-card">
                <div className="victory-page__round-header">
                  <div>
                    <span>
                      Turn {round.turnNumber} · {TEAM_LABELS[round.activeTeam]}
                    </span>
                    <strong>{round.clueText ? `"${round.clueText}"` : 'Waiting clue'} / {round.clueCount ?? '—'}</strong>
                  </div>
                  <span className="victory-page__pill">{round.outcomeLabel}</span>
                </div>

                <div className="victory-page__round-metrics">
                  <div>
                    <span>Active Accuracy</span>
                    <strong>{formatAccuracy(round.activeVoteAccuracy)}</strong>
                  </div>
                  <div>
                    <span>Passive Accuracy</span>
                    <strong>{formatAccuracy(round.passiveVoteAccuracy)}</strong>
                  </div>
                  <div>
                    <span>Participation</span>
                    <strong>
                      {round.activeVoterCount} active / {round.passiveVoterCount} passive
                    </strong>
                  </div>
                  <div>
                    <span>Reveals</span>
                    <strong>
                      {round.correctReveals} correct / {round.mistakeCount} mistakes
                    </strong>
                  </div>
                </div>

                <div className="victory-page__round-votes">
                  <div>
                    <span>Turn Team Votes</span>
                    {round.activeVotedWords.length ? (
                      <div className="victory-page__reveal-list">
                        {round.activeVotedWords.map((word) => (
                          <span key={`${round.turnNumber}-active-${word}`} className="victory-page__reveal victory-page__reveal--neutral">
                            {word}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="supporting-text">No active votes were recorded this round.</p>
                    )}
                  </div>

                  <div>
                    <span>Passive Team Votes</span>
                    {round.passiveVotedWords.length ? (
                      <div className="victory-page__reveal-list">
                        {round.passiveVotedWords.map((word) => (
                          <span key={`${round.turnNumber}-passive-${word}`} className="victory-page__reveal victory-page__reveal--mistake">
                            {word}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="supporting-text">No passive votes were recorded this round.</p>
                    )}
                  </div>
                </div>

                <div className="victory-page__round-reveals">
                  <span>Reveal Sequence</span>
                  {round.revealSequence.length ? (
                    <div className="victory-page__reveal-list">
                      {round.revealSequence.map((reveal) => (
                        <span
                          key={`${round.turnNumber}-${reveal.tileId}`}
                          className={`victory-page__reveal ${getRevealTone(round.activeTeam, reveal.ownerColor)}`}
                        >
                          {reveal.word}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="supporting-text">No cards were revealed in this round.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="victory-page__footer">
          {canControl ? (
            <div className="victory-page__actions">
              <button type="button" className="button button--primary" onClick={onRematch}>
                Rematch
              </button>
              <button type="button" className="button button--primary" onClick={onStartOver}>
                Start Over
              </button>
            </div>
          ) : (
            <p className="supporting-text">Waiting for teacher to choose the next step.</p>
          )}
        </footer>
      </section>
    </main>
  );
}
