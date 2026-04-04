import { useEffect, useRef, useState } from 'react';

const previewTiles = [
  { word: 'TRADE', backTone: 'red' },
  { word: 'MARKET', backTone: 'red' },
  { word: 'SUPPLY', backTone: 'blue' },
  { word: 'DEMAND', backTone: 'blue' },
  { word: 'LABOR', backTone: 'red' },
  { word: 'STOCK', backTone: 'blue' },
  { word: 'BOND', backTone: 'red' },
  { word: 'ASSET', backTone: 'blue' },
  { word: 'LOAN', backTone: 'red' },
  { word: 'PROFIT', backTone: 'red' },
  { word: 'GROWTH', backTone: 'red' },
  { word: 'VALUE', backTone: 'blue' },
  { word: 'RISK', backTone: 'assassin' },
  { word: 'CREDIT', backTone: 'blue' },
  { word: 'INDEX', backTone: 'red' },
  { word: 'TAX', backTone: 'blue' },
  { word: 'BANK', backTone: 'blue' },
  { word: 'CASH', backTone: 'red' },
  { word: 'TRADE', backTone: 'red' },
  { word: 'GOLD', backTone: 'blue' },
  { word: 'DEBT', backTone: 'blue' },
  { word: 'SAVE', backTone: 'red' },
  { word: 'PLAN', backTone: 'blue' },
  { word: 'FUND', backTone: 'blue' },
  { word: 'COST', backTone: 'red' }
] as const;

export function StartBoardPreview() {
  const [flippedTileIndices, setFlippedTileIndices] = useState<number[]>([]);
  const cooldownUntilRef = useRef<number[]>(Array.from({ length: previewTiles.length }, () => 0));
  const timeoutIdsRef = useRef<number[]>([]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now();

      setFlippedTileIndices((currentFlippedTileIndices) => {
        const availableTileIndices = previewTiles
          .map((_tile, index) => index)
          .filter((index) => !currentFlippedTileIndices.includes(index) && cooldownUntilRef.current[index] <= now);

        if (!availableTileIndices.length) {
          return currentFlippedTileIndices;
        }

        const nextTileIndex = availableTileIndices[Math.floor(Math.random() * availableTileIndices.length)];
        const timeoutId = window.setTimeout(() => {
          cooldownUntilRef.current[nextTileIndex] = Date.now() + 8000;
          setFlippedTileIndices((activeTileIndices) => activeTileIndices.filter((index) => index !== nextTileIndex));
        }, 5000);

        timeoutIdsRef.current.push(timeoutId);

        return [...currentFlippedTileIndices, nextTileIndex];
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current = [];
    };
  }, []);

  return (
    <div className="start-board-shell">
      <div className="start-board-grid">
        {previewTiles.map((tile, index) => (
          <div
            key={`${tile.word}-${index}`}
            className={`start-board-tile ${flippedTileIndices.includes(index) ? 'start-board-tile--flipped' : ''}`}
          >
            <div className="start-board-tile__inner">
              <div className="start-board-tile__face start-board-tile__face--front">
                <span>{tile.word}</span>
              </div>
              <div className={`start-board-tile__face start-board-tile__face--back start-board-tile__face--${tile.backTone}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
