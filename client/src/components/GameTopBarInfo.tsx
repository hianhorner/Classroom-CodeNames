import type { AssignmentSummary, PlayerSummary } from '@classroom-codenames/shared';

type GameTopBarInfoProps = {
  players: PlayerSummary[];
  assignments: AssignmentSummary[];
  viewerName: string;
};

function getAssignedCounts(players: PlayerSummary[], assignments: AssignmentSummary[]) {
  const playerMap = new Map(players.map((player) => [player.id, player]));

  const counts = assignments.reduce(
    (totals, assignment) => {
      const player = playerMap.get(assignment.playerId);

      if (!player || player.isTeacher || assignment.team === null) {
        return totals;
      }

      totals.total += 1;
      if (assignment.team === 'red') {
        totals.red += 1;
      } else {
        totals.blue += 1;
      }

      return totals;
    },
    { total: 0, red: 0, blue: 0 }
  );

  return counts;
}

export function GameTopBarInfo({ players, assignments, viewerName }: GameTopBarInfoProps) {
  const counts = getAssignedCounts(players, assignments);

  return (
    <div className="app-topbar__player-info">
      <div className="app-topbar__player-stats" aria-label="Assigned player counts">
        <span className="app-topbar__player-stat">Total players: {counts.total}</span>
        <span className="app-topbar__player-stat">Red: {counts.red}</span>
        <span className="app-topbar__player-stat">Blue: {counts.blue}</span>
      </div>
      <span className="app-topbar__player-name-label">Your name:</span>
      <div className="app-topbar__profile">{viewerName}</div>
    </div>
  );
}
