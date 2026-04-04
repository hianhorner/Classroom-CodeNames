import type { ChannelKey, Team } from './types';

export const TEAM_LABELS: Record<Team, string> = {
  red: 'Red',
  blue: 'Blue'
};

export const CHANNEL_KEYS: ChannelKey[] = [
  'red_guessers',
  'red_spymasters',
  'blue_guessers',
  'blue_spymasters'
];

export const LOCAL_SESSION_KEY = 'classroom-codenames/session';
