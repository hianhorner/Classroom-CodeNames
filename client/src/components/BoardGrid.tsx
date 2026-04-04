import type { BoardTileView, Team } from '@classroom-codenames/shared';
import { WordCard } from './WordCard';

type BoardGridProps = {
  tiles: BoardTileView[];
  interactive?: boolean;
  revealMode?: boolean;
  variant?: 'play' | 'presentation';
  voteDisplayMode?: 'single' | 'split';
  activeTeam?: Team | null;
  showRedVotes?: boolean;
  showBlueVotes?: boolean;
  onTileClick?: (tileId: string) => void;
};

export function BoardGrid({
  tiles,
  interactive = false,
  revealMode = false,
  variant = 'play',
  voteDisplayMode = 'single',
  activeTeam = null,
  showRedVotes = true,
  showBlueVotes = true,
  onTileClick
}: BoardGridProps) {
  return (
    <section className={`board-grid board-grid--${variant}`}>
      {tiles.map((tile) => (
        <WordCard
          key={tile.id}
          tile={tile}
          interactive={interactive && !tile.isRevealed && (!revealMode || tile.isRevealable)}
          revealMode={revealMode}
          variant={variant}
          voteDisplayMode={voteDisplayMode}
          activeTeam={activeTeam}
          showRedVotes={showRedVotes}
          showBlueVotes={showBlueVotes}
          onClick={onTileClick}
        />
      ))}
    </section>
  );
}
