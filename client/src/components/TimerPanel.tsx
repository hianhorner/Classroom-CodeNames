import type { TimerState } from '@classroom-codenames/shared';
import { formatTimer } from '../utils/format';

type TimerPanelProps = {
  seconds: number;
  enabled: boolean;
  state: TimerState;
  controls?: {
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
  };
};

export function TimerPanel({ seconds, enabled, state, controls }: TimerPanelProps) {
  return (
    <section className="paper-panel timer-panel">
      <div className="section-heading">
        <p className="eyebrow">Clue Timer</p>
        <h3 className="timer-panel__value">{formatTimer(seconds)}</h3>
      </div>
      <p className="supporting-text">
        {enabled ? `Timer is ${state}. Reaching zero does not force a turn change in Phase 1.` : 'Timer disabled for this room.'}
      </p>
      {controls ? (
        <div className="timer-panel__controls">
          <button type="button" className="button button--secondary" onClick={controls.onStart} disabled={!enabled}>
            Start
          </button>
          <button type="button" className="button button--secondary" onClick={controls.onPause} disabled={!enabled}>
            Pause
          </button>
          <button type="button" className="button button--secondary" onClick={controls.onReset} disabled={!enabled}>
            Reset
          </button>
        </div>
      ) : null}
    </section>
  );
}
