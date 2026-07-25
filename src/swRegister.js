const SW_VERSION = 'v23';
const SW_URL = `./sw.js?${SW_VERSION}`;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      let hasRefreshedForNewWorker = false;

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasRefreshedForNewWorker) {
          return;
        }
        hasRefreshedForNewWorker = true;
        window.location.reload();
      });

      const registration = await navigator.serviceWorker.register(SW_URL);
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) {
          return;
        }

        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      registration.update().catch(() => {});
    } catch (error) {
      console.error('Service worker registration failed', error);
    }
  });
}
