import clsx from 'clsx';
import type { BoardTileView, Team } from '@classroom-codenames/shared';

type WordCardProps = {
  tile: BoardTileView;
  interactive?: boolean;
  revealMode?: boolean;
  variant?: 'play' | 'presentation';
  voteDisplayMode?: 'single' | 'split';
  activeTeam?: Team | null;
  showRedVotes?: boolean;
  showBlueVotes?: boolean;
  onClick?: (tileId: string) => void;
};

function getToneClass(tile: BoardTileView) {
  if (!tile.ownerColor) {
    return 'word-card--paper';
  }

  if (!tile.isRevealed) {
    if (tile.ownerColor === 'neutral') {
      return 'word-card--neutral-key';
    }

    if (tile.ownerColor === 'assassin') {
      return 'word-card--assassin-key';
    }

    return tile.ownerColor === 'red' ? 'word-card--red-key' : 'word-card--blue-key';
  }

  if (tile.ownerColor === 'neutral') {
    return 'word-card--neutral';
  }

  if (tile.ownerColor === 'assassin') {
    return 'word-card--assassin';
  }

  return tile.ownerColor === 'red' ? 'word-card--red' : 'word-card--blue';
}

export function WordCard({
  tile,
  interactive = false,
  revealMode = false,
  variant = 'play',
  voteDisplayMode = 'single',
  activeTeam = null,
  showRedVotes = true,
  showBlueVotes = true,
  onClick
}: WordCardProps) {
  const redBadgeTone = activeTeam === 'red' ? 'active' : activeTeam === 'blue' ? 'passive' : null;
  const blueBadgeTone = activeTeam === 'blue' ? 'active' : activeTeam === 'red' ? 'passive' : null;

  return (
    <button
      type="button"
      className={clsx(
        'word-card',
        variant === 'presentation' ? 'word-card--presentation' : 'word-card--play',
        getToneClass(tile),
        interactive && 'word-card--interactive',
        tile.isViewerVote && 'word-card--viewer-vote',
        revealMode && tile.isRevealable && 'word-card--revealable',
        revealMode && 'word-card--reveal-mode'
      )}
      onClick={() => onClick?.(tile.id)}
      disabled={!interactive}
    >
      <span className="word-card__word">{tile.word}</span>
      {voteDisplayMode === 'split' ? (
        <div className="word-card__meta word-card__meta--split">
          <span className="word-card__meta-side word-card__meta-side--left">
            {showRedVotes && tile.redVoteCount > 0 ? (
              <span
                className={clsx(
                  'vote-badge',
                  'vote-badge--red',
                  redBadgeTone === 'active' && 'vote-badge--active',
                  redBadgeTone === 'passive' && 'vote-badge--passive'
                )}
              >
                {tile.redVoteCount}
              </span>
            ) : null}
          </span>
          <span className="word-card__meta-side word-card__meta-side--right">
            {showBlueVotes && tile.blueVoteCount > 0 ? (
              <span
                className={clsx(
                  'vote-badge',
                  'vote-badge--blue',
                  blueBadgeTone === 'active' && 'vote-badge--active',
                  blueBadgeTone === 'passive' && 'vote-badge--passive'
                )}
              >
                {tile.blueVoteCount}
              </span>
            ) : null}
          </span>
        </div>
      ) : (
        <div className="word-card__meta">
          {tile.voteCount > 0 ? <span className="vote-badge">{tile.voteCount}</span> : <span />}
        </div>
      )}
    </button>
  );
}
