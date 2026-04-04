import { TEAM_LABELS, type RoomViewState } from '@classroom-codenames/shared';

type TurnStatusBarProps = {
  state: RoomViewState;
};

export function TurnStatusBar({ state }: TurnStatusBarProps) {
  return (
    <section className="turn-status">
      <div>
        <p className="eyebrow">Current Turn</p>
        <h2>{state.room.currentTurnTeam ? `${TEAM_LABELS[state.room.currentTurnTeam]} Team` : 'Lobby Setup'}</h2>
      </div>
      <div className="turn-status__summary">
        <article>
          <span>Red Remaining</span>
          <strong>{state.teamStatus.red.remainingWords}</strong>
        </article>
        <article>
          <span>Blue Remaining</span>
          <strong>{state.teamStatus.blue.remainingWords}</strong>
        </article>
        <article>
          <span>Phase</span>
          <strong>{state.room.gamePhase}</strong>
        </article>
      </div>
    </section>
  );
}
