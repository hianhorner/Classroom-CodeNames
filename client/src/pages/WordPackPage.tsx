import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppTopBar } from '../components/AppTopBar';
import { useCanvasTheme } from '../hooks/useCanvasTheme';
import {
  applyManualWordPack,
  applySavedWordPack,
  applySpreadsheetWordPack,
  getWordPackTemplateUrl,
  getWordPacks,
  saveManualWordPack,
  saveSpreadsheetWordPack
} from '../services/api';
import { useRoomState } from '../hooks/useRoomState';

function parseManualWords(input: string) {
  return input
    .split(/[\n,\r]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function getManualValidation(input: string) {
  const words = parseManualWords(input);
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  words.forEach((word) => {
    const key = word.toLocaleLowerCase();
    if (seen.has(key)) {
      duplicates.add(word);
    }
    seen.add(key);
  });

  if (duplicates.size) {
    return {
      isValid: false,
      count: words.length,
      message: `Duplicate words found: ${Array.from(duplicates).join(', ')}.`
    };
  }

  if (words.length !== 25) {
    return {
      isValid: false,
      count: words.length,
      message: `Enter exactly 25 unique words. You currently have ${words.length}.`
    };
  }

  return {
    isValid: true,
    count: words.length,
    message: '25 unique words ready to use.'
  };
}

export function WordPackPage() {
  const navigate = useNavigate();
  const { roomCode = '' } = useParams();
  const normalizedRoomCode = roomCode.toUpperCase();
  const { state, session, isLoading, error } = useRoomState(normalizedRoomCode, 'lobby');
  const [wordPacks, setWordPacks] = useState<Awaited<ReturnType<typeof getWordPacks>>>([]);
  const [selectedWordPackId, setSelectedWordPackId] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualWords, setManualWords] = useState('');
  const [spreadsheetFile, setSpreadsheetFile] = useState<File | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useCanvasTheme('silver');

  const manualValidation = useMemo(() => getManualValidation(manualWords), [manualWords]);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (!state.viewer.isTeacher) {
      navigate(`/room/${normalizedRoomCode}/${state.viewer.route}`, { replace: true });
      return;
    }

    if (state.room.status !== 'lobby') {
      navigate(`/room/${normalizedRoomCode}/presentation`, { replace: true });
    }
  }, [navigate, normalizedRoomCode, state]);

  useEffect(() => {
    if (!session?.playerId) {
      return;
    }

    void (async () => {
      try {
        const packs = await getWordPacks(normalizedRoomCode, session.playerId);
        setWordPacks(packs);
      } catch (loadError) {
        setPageError(loadError instanceof Error ? loadError.message : 'Unable to load saved word packs.');
      }
    })();
  }, [normalizedRoomCode, session?.playerId]);

  useEffect(() => {
    if (state?.wordPack.selectedPackId) {
      setSelectedWordPackId(state.wordPack.selectedPackId);
    }
  }, [state?.wordPack.selectedPackId]);

  async function refreshWordPacks() {
    if (!session?.playerId) {
      return;
    }

    const packs = await getWordPacks(normalizedRoomCode, session.playerId);
    setWordPacks(packs);
  }

  async function withPageAction(action: () => Promise<void>) {
    setIsBusy(true);
    setPageError(null);
    setPageMessage(null);

    try {
      await action();
    } catch (actionError) {
      setPageError(actionError instanceof Error ? actionError.message : 'Something went wrong.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleManualSave() {
    if (!session?.playerId) {
      return;
    }

    if (!manualValidation.isValid) {
      setPageError(manualValidation.message);
      return;
    }

    await withPageAction(async () => {
      const savedPack = await saveManualWordPack(normalizedRoomCode, {
        playerId: session.playerId,
        name: manualName,
        words: manualWords
      });
      await refreshWordPacks();
      setSelectedWordPackId(savedPack.id);
      setPageMessage(`Saved "${savedPack.name}" to the word-pack library.`);
    });
  }

  async function handleManualApply() {
    if (!session?.playerId) {
      return;
    }

    if (!manualValidation.isValid) {
      setPageError(manualValidation.message);
      return;
    }

    await withPageAction(async () => {
      await applyManualWordPack(normalizedRoomCode, {
        playerId: session.playerId,
        name: manualName,
        words: manualWords
      });
      navigate(`/room/${normalizedRoomCode}/lobby`);
    });
  }

  async function handleSpreadsheetSave() {
    if (!session?.playerId || !spreadsheetFile) {
      setPageError('Choose a .xlsx file before saving a spreadsheet word pack.');
      return;
    }

    await withPageAction(async () => {
      const savedPack = await saveSpreadsheetWordPack(normalizedRoomCode, session.playerId, spreadsheetFile);
      await refreshWordPacks();
      setSelectedWordPackId(savedPack.id);
      setPageMessage(`Saved "${savedPack.name}" from the spreadsheet upload.`);
    });
  }

  async function handleSpreadsheetApply() {
    if (!session?.playerId || !spreadsheetFile) {
      setPageError('Choose a .xlsx file before applying a spreadsheet word pack.');
      return;
    }

    await withPageAction(async () => {
      await applySpreadsheetWordPack(normalizedRoomCode, session.playerId, spreadsheetFile);
      navigate(`/room/${normalizedRoomCode}/lobby`);
    });
  }

  async function handleApplySavedWordPack() {
    if (!session?.playerId || !selectedWordPackId) {
      setPageError('Choose a saved word pack before applying it.');
      return;
    }

    await withPageAction(async () => {
      await applySavedWordPack(normalizedRoomCode, selectedWordPackId, {
        playerId: session.playerId
      });
      navigate(`/room/${normalizedRoomCode}/lobby`);
    });
  }

  if (isLoading || !state) {
    return <main className="page-shell"><section className="paper-panel"><p>Loading word packs…</p></section></main>;
  }

  return (
    <>
      <AppTopBar
        variant="surface"
        links={[
          { label: 'Lobby', to: `/room/${normalizedRoomCode}/lobby` },
          { label: 'Presentation', to: `/room/${normalizedRoomCode}/presentation` }
        ]}
        rightSlot={<div className="app-topbar__profile">{state.viewer.name ?? 'Teacher'}</div>}
      />

      <main className="page-shell page-shell--with-topbar wordpack-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Teacher Setup</p>
            <h1>Wordpack Library</h1>
            <p className="supporting-text">
              Build a custom 25-word pack, upload a spreadsheet template, or choose a saved pack for this room before the game starts.
            </p>
          </div>
          <div className="wordpack-page__header-status">
            <span className="info-pill info-pill--solid">
              {state.wordPack.usesDefaultPack
                ? 'Using default word bank'
                : `Room pack: ${state.wordPack.selectedPackName ?? 'Custom pack'}`}
            </span>
          </div>
        </header>

        <div className="wordpack-layout">
          <section className="wordpack-layout__main">
            <section className="paper-panel wordpack-panel">
              <div className="section-heading">
                <p className="eyebrow">Manual Entry</p>
                <h3>Build a custom 25-word set</h3>
              </div>

              <div className="stack-form wordpack-panel__form">
                <label>
                  <span>Word-pack name</span>
                  <input
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder="Spring Vocabulary Week"
                    disabled={isBusy}
                  />
                </label>

                <label>
                  <span>Words</span>
                  <textarea
                    className="wordpack-panel__textarea"
                    value={manualWords}
                    onChange={(event) => setManualWords(event.target.value)}
                    placeholder="apple, bridge, canyon, delta, ember..."
                    disabled={isBusy}
                  />
                </label>
              </div>

              <div className="wordpack-panel__hint-block">
                <p className="supporting-text">
                  Enter exactly 25 unique words separated by commas. These words will be randomized onto the game board when the room starts.
                </p>
                <div className={`wordpack-validation ${manualValidation.isValid ? 'wordpack-validation--valid' : 'wordpack-validation--warning'}`}>
                  <strong>{manualValidation.count} / 25 words</strong>
                  <span>{manualValidation.message}</span>
                </div>
              </div>

              <div className="wordpack-panel__actions">
                <button className="button button--secondary" type="button" onClick={handleManualSave} disabled={isBusy}>
                  Save this Wordpack
                </button>
                <button className="button button--primary" type="button" onClick={handleManualApply} disabled={isBusy}>
                  Use and return to Lobby
                </button>
              </div>
            </section>

            <section className="paper-panel wordpack-panel">
              <div className="section-heading">
                <p className="eyebrow">Spreadsheet Upload</p>
                <h3>Use an Excel word-pack template</h3>
              </div>

              <div className="wordpack-upload-card">
                <p className="supporting-text">
                  Upload a `.xlsx` file with a pack name, random words, and optional Red, Blue, and Assassin overrides. The upload validates only when the template rules are followed.
                </p>
                <div className="wordpack-upload-card__controls">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => setSpreadsheetFile(event.target.files?.[0] ?? null)}
                    disabled={isBusy}
                  />
                  <a
                    className="button button--secondary"
                    href={getWordPackTemplateUrl(normalizedRoomCode, session?.playerId ?? '')}
                  >
                    Download Template
                  </a>
                </div>
                <div className="wordpack-upload-card__file-state">
                  {spreadsheetFile ? `Selected file: ${spreadsheetFile.name}` : 'No spreadsheet selected yet.'}
                </div>
              </div>

              <div className="wordpack-panel__actions">
                <button className="button button--secondary" type="button" onClick={handleSpreadsheetSave} disabled={isBusy}>
                  Save this Wordpack
                </button>
                <button className="button button--primary" type="button" onClick={handleSpreadsheetApply} disabled={isBusy}>
                  Use and return to Lobby
                </button>
              </div>
            </section>
          </section>

          <aside className="wordpack-layout__rail">
            <section className="paper-panel wordpack-panel wordpack-library-panel">
              <div className="section-heading">
                <p className="eyebrow">Saved Wordpacks</p>
                <h3>Reusable library</h3>
              </div>
              <p className="supporting-text">
                Saved word packs stay on this machine, so you can reuse them in future rooms by name.
              </p>

              <div className="wordpack-library-grid">
                {wordPacks.length ? (
                  wordPacks.map((wordPack) => (
                    <button
                      key={wordPack.id}
                      type="button"
                      className={`wordpack-card ${selectedWordPackId === wordPack.id ? 'wordpack-card--selected' : ''}`}
                      onClick={() => setSelectedWordPackId(wordPack.id)}
                    >
                      <strong>{wordPack.name}</strong>
                    </button>
                  ))
                ) : (
                  <div className="wordpack-library-grid__empty">No saved word packs yet.</div>
                )}
              </div>

              <button className="button button--primary" type="button" onClick={handleApplySavedWordPack} disabled={isBusy || !selectedWordPackId}>
                Use and return to Lobby
              </button>
            </section>
          </aside>
        </div>

        {pageMessage ? <p className="supporting-text">{pageMessage}</p> : null}
        {pageError || error ? <p className="error-banner">{pageError ?? error}</p> : null}
      </main>
    </>
  );
}
