const statusBadge = document.querySelector('[data-role="status-badge"]');
const statusMessage = document.querySelector('[data-role="status-message"]');
const errorMessage = document.querySelector('[data-role="error-message"]');
const localUrl = document.querySelector('[data-role="local-url"]');
const lanUrl = document.querySelector('[data-role="lan-url"]');
const dataPath = document.querySelector('[data-role="data-path"]');
const logsPath = document.querySelector('[data-role="logs-path"]');
const openTeacherButton = document.querySelector('[data-action="open-teacher"]');
const openBrowserButton = document.querySelector('[data-action="open-browser"]');
const copyLanButton = document.querySelector('[data-action="copy-lan"]');
const restartButton = document.querySelector('[data-action="restart"]');
const openDataButton = document.querySelector('[data-action="open-data"]');
const openLogsButton = document.querySelector('[data-action="open-logs"]');

function formatStatusPhase(phase) {
  switch (phase) {
    case 'ready':
      return 'Ready';
    case 'starting':
      return 'Starting';
    case 'error':
      return 'Error';
    default:
      return 'Preparing';
  }
}

function setButtonState(button, enabled) {
  if (!button) {
    return;
  }

  button.disabled = !enabled;
}

function renderStatus(status) {
  document.body.dataset.phase = status.phase;
  statusBadge.textContent = formatStatusPhase(status.phase);
  statusMessage.textContent = status.message;
  errorMessage.textContent = status.error ?? '';
  errorMessage.hidden = !status.error;

  localUrl.textContent = status.localUrl || 'Not ready yet';
  lanUrl.textContent = status.lanUrl || 'Detecting local network address...';
  dataPath.textContent = status.dataPath || 'Preparing app storage...';
  logsPath.textContent = status.logsPath || 'Preparing logs...';

  const isReady = status.phase === 'ready';
  const hasFolders = Boolean(status.dataPath && status.logsPath);

  setButtonState(openTeacherButton, isReady);
  setButtonState(openBrowserButton, isReady);
  setButtonState(copyLanButton, isReady && Boolean(status.lanUrl));
  setButtonState(openDataButton, hasFolders);
  setButtonState(openLogsButton, hasFolders);
  setButtonState(restartButton, status.phase !== 'starting');
}

async function boot() {
  const hostApi = window.classroomCodeNamesHost;

  openTeacherButton?.addEventListener('click', async () => {
    await hostApi.openTeacherWindow();
  });

  openBrowserButton?.addEventListener('click', async () => {
    await hostApi.openBrowser();
  });

  copyLanButton?.addEventListener('click', async () => {
    const copiedUrl = await hostApi.copyLanUrl();
    copyLanButton.textContent = copiedUrl ? 'Copied' : 'Copy LAN URL';

    window.setTimeout(() => {
      copyLanButton.textContent = 'Copy LAN URL';
    }, 1400);
  });

  restartButton?.addEventListener('click', async () => {
    await hostApi.restartServer();
  });

  openDataButton?.addEventListener('click', async () => {
    await hostApi.openDataFolder();
  });

  openLogsButton?.addEventListener('click', async () => {
    await hostApi.openLogsFolder();
  });

  const initialStatus = await hostApi.getStatus();
  renderStatus(initialStatus);
  hostApi.onStatus(renderStatus);
}

boot().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unable to load the Classroom CodeNames host controls.';
  renderStatus({
    phase: 'error',
    message: 'The Classroom CodeNames host window could not initialize.',
    localUrl: '',
    lanUrl: '',
    dataPath: '',
    logsPath: '',
    error: message
  });
});
