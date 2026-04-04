import type { ChannelKey, Role, Team } from './types';

export function otherTeam(team: Team): Team {
  return team === 'red' ? 'blue' : 'red';
}

export function getChannelKey(team: Team, role: Role): ChannelKey {
  return `${team}_${role}s` as ChannelKey;
}

export function getRouteForRole(role: Role): 'guesser' | 'spymaster' {
  return role === 'guesser' ? 'guesser' : 'spymaster';
}

export function formatRoleLabel(team: Team, role: Role): string {
  return `${team === 'red' ? 'Red' : 'Blue'} ${role === 'guesser' ? 'Guessers' : 'Spymasters'}`;
}
