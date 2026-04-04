export function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${seconds}`;
}

export function titleCaseWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
