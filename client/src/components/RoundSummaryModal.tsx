import { TEAM_LABELS, type OwnerColor, type RoundSummary } from '@classroom-codenames/shared';

type RoundSummaryModalProps = {
  summary: RoundSummary;
  variant: 'presentation' | 'player';
  canContinue?: boolean;
  onContinue?: () => void;
};

function formatAccuracy(value: number | null) {
  return value === null ? 'N/A' : `${value}%`;
}

function formatReasonLabel(reason: RoundSummary['endReason']) {
  switch (reason) {
    case 'teacher_ended':
      return 'Teacher Ended Early';
    case 'turn_completed':
      return 'Round Complete';
    case 'allowance_exhausted':
      return 'Allowance Used';
    case 'wrong_reveal':
      return 'Wrong Reveal';
    case 'assassin':
      return 'Assassin';
    case 'team_completed':
      return 'Board Cleared';
    case 'opponent_completed':
      return 'Opponent Cleared';
  }
}

function getRevealTone(ownerColor: OwnerColor) {
  if (ownerColor === 'red') {
    return 'round-summary-modal__reveal--red';
  }

  if (ownerColor === 'blue') {
    return 'round-summary-modal__reveal--blue';
  }

  if (ownerColor === 'assassin') {
    return 'round-summary-modal__reveal--assassin';
  }

  return 'round-summary-modal__reveal--neutral';
}

export function RoundSummaryModal({
  summary,
  variant,
  canContinue = false,
  onContinue
}: RoundSummaryModalProps) {
  return (
    <div className={`round-summary-overlay round-summary-overlay--${variant}`} role="dialog" aria-modal="true">
      <div className="round-summary-overlay__backdrop" />
      <section className="paper-panel round-summary-modal">
        <header className="round-summary-modal__header">
          <p className="eyebrow">{TEAM_LABELS[summary.activeTeam]} clue recap</p>
          <h2>{summary.outcomeLabel}</h2>
          <p className="supporting-text">{summary.outcomeDetail}</p>
          <div className="round-summary-modal__clue-row">
            <span className="round-summary-modal__clue-pill">Clue: {summary.clueText}</span>
            <span className="round-summary-modal__clue-pill">Count: {summary.clueCount}</span>
          </div>
        </header>

        <section className="round-summary-modal__headline-grid">
          <article className="round-summary-modal__stat-card">
            <span>Words Revealed</span>
            <strong>{summary.wordsRevealed}</strong>
          </article>
          <article className="round-summary-modal__stat-card">
            <span>Vote Accuracy</span>
            <strong>{formatAccuracy(summary.activeVoteAccuracy)}</strong>
          </article>
        </section>

        <section className="round-summary-modal__detail-grid">
          <article className="round-summary-modal__detail-card">
            <span>Opposing Prediction Accuracy</span>
            <strong>{formatAccuracy(summary.passiveVoteAccuracy)}</strong>
          </article>
          <article className="round-summary-modal__detail-card">
            <span>Participation</span>
            <strong>
              {summary.activeVoterCount} active / {summary.passiveVoterCount} passive
            </strong>
          </article>
          <article className="round-summary-modal__detail-card">
            <span>End Reason</span>
            <strong>{formatReasonLabel(summary.endReason)}</strong>
          </article>
          <article className="round-summary-modal__detail-card">
            <span>Next Up</span>
            <strong>{summary.winningTeam ? `${TEAM_LABELS[summary.winningTeam]} wins` : summary.nextTeam ? TEAM_LABELS[summary.nextTeam] : 'Game Over'}</strong>
          </article>
        </section>

        <section className="round-summary-modal__reveals">
          <span>Reveal Sequence</span>
          {summary.revealSequence.length ? (
            <div className="round-summary-modal__reveal-list">
              {summary.revealSequence.map((reveal) => (
                <span key={`${reveal.tileId}-${reveal.word}`} className={`round-summary-modal__reveal ${getRevealTone(reveal.ownerColor)}`}>
                  {reveal.word}
                </span>
              ))}
            </div>
          ) : (
            <p className="supporting-text">No cards were revealed in this clue cycle.</p>
          )}
        </section>

        <footer className="round-summary-modal__footer">
          {canContinue ? (
            <button type="button" className="button button--primary" onClick={onContinue}>
              Continue
            </button>
          ) : (
            <p className="supporting-text">
              {summary.winningTeam ? 'Game over. Waiting for the teacher to decide what to do next.' : 'Waiting for teacher to continue.'}
            </p>
          )}
        </footer>
      </section>
    </div>
  );
}
