import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessageView } from '@classroom-codenames/shared';

type ChatPanelProps = {
  title: string;
  messages: ChatMessageView[];
  currentPlayerId?: string | null;
  disabled?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onSend?: (message: string) => void;
};

export function ChatPanel({
  title,
  messages,
  currentPlayerId,
  disabled = false,
  expandable = false,
  expanded = false,
  onToggleExpanded,
  onSend
}: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const orderedMessages = [...messages].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: 0 });
  }, [orderedMessages.length, orderedMessages[0]?.id]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!message.trim()) {
      return;
    }

    onSend?.(message);
    setMessage('');
  }

  return (
    <section className={`paper-panel chat-panel ${expanded ? 'chat-panel--expanded' : ''}`}>
      <div className="section-heading chat-panel__header">
        <div>
          <p className="eyebrow">Subgroup Chat</p>
          <h3>{title}</h3>
        </div>
        {expandable ? (
          <button
            type="button"
            className="button button--secondary button--compact chat-panel__toggle"
            onClick={onToggleExpanded}
          >
            {expanded ? 'Close Chat' : 'Expand Chat'}
          </button>
        ) : null}
      </div>
      <div className="chat-panel__messages" ref={messagesRef}>
        {orderedMessages.length ? (
          orderedMessages.map((entry) => (
            <article
              key={entry.id}
              className={`chat-message ${entry.playerId === currentPlayerId ? 'chat-message--mine' : 'chat-message--theirs'}`}
            >
              <header>
                <strong>{entry.playerName}</strong>
                <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </header>
              <p>{entry.message}</p>
            </article>
          ))
        ) : (
          <p className="empty-state">Your subgroup chat will appear here once teammates start talking.</p>
        )}
      </div>
      <form className="chat-panel__composer" onSubmit={handleSubmit}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={disabled ? 'Chat opens once you are assigned.' : 'Share a thought with your subgroup'}
          disabled={disabled}
        />
        <button type="submit" className="button button--primary" disabled={disabled}>
          Send
        </button>
      </form>
    </section>
  );
}
