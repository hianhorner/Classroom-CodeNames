const statusBadge = document.querySelector('[data-role="status-badge"]');
const statusMessage = document.querySelector('[data-role="status-message"]');
const errorMessage = document.querySelector('[data-role="error-message"]');
const startButton = document.querySelector('[data-action="start"]');
const restartButton = document.querySelector('[data-action="restart"]');

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

  const isReady = status.phase === 'ready' && Boolean(status.lanUrl);
  setButtonState(startButton, isReady);
  setButtonState(restartButton, status.phase !== 'starting');
}

async function boot() {
  const hostApi = window.classroomCodeNamesHost;

  startButton?.addEventListener('click', async () => {
    await hostApi.openStart();
  });

  restartButton?.addEventListener('click', async () => {
    await hostApi.restartServer();
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
    lanUrl: '',
    error: message
  });
});
