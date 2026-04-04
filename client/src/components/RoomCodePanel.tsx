import { useRef, useState } from 'react';

type RoomCodePanelProps = {
  roomCode: string;
  joinLink: string;
};

export function RoomCodePanel({ roomCode, joinLink }: RoomCodePanelProps) {
  const [copyState, setCopyState] = useState<'copy' | 'copied' | 'failed'>('copy');
  const joinLinkRef = useRef<HTMLAnchorElement | null>(null);

  function copyWithFallback(value: string) {
    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', 'true');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  async function handleCopyJoinLink() {
    const hrefValue = joinLinkRef.current?.getAttribute('href')?.trim() || joinLink;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(hrefValue);
      } else if (!copyWithFallback(hrefValue)) {
        throw new Error('Clipboard copy failed.');
      }

      setCopyState('copied');
    } catch {
      setCopyState(copyWithFallback(hrefValue) ? 'copied' : 'failed');
    }

    window.setTimeout(() => setCopyState('copy'), 1600);
  }

  return (
    <section className="paper-panel room-code-panel">
      <div className="section-heading">
        <p className="eyebrow">Classroom Access</p>
        <h3>Room</h3>
      </div>
      <div className="room-code-panel__code">{roomCode}</div>
      <div className="room-code-panel__grid">
        <article>
          <span>Student Login</span>
          <div className="room-code-panel__link-row">
            <a ref={joinLinkRef} href={joinLink} target="_blank" rel="noreferrer">
              {joinLink}
            </a>
            <button type="button" className="button button--secondary room-code-panel__copy-button" onClick={handleCopyJoinLink}>
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Retry' : 'Copy'}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
