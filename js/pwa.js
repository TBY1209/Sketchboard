/* Installable app: service worker for offline use, and an "Install app" command when the browser offers it. */
let installPrompt = null;
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol))
  addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('offline mode unavailable', err))
  );
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
});
addEventListener('appinstalled', () => {
  installPrompt = null;
  toast('Sketchboard is installed');
});
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    try {
      await installPrompt.userChoice;
    } catch (_) {}
    installPrompt = null;
    return;
  }
  modal(
    `<h3>Install Sketchboard</h3><p>${
      isIOS()
        ? 'In Safari, tap the Share button, then <b>Add to Home Screen</b>.'
        : 'Use your browser’s menu and choose <b>Install app</b> or <b>Add to Home screen</b>.'
    } It then opens like a normal app and works without internet.</p><div class="mrow"><button class="btn pri" data-close>Got it</button></div>`
  );
}
/* keep the browser chrome colour in step with the board */
function syncThemeColor() {
  const c = getComputedStyle(document.body).backgroundColor;
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', c);
}
