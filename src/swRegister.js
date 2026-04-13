const SW_VERSION = 'v17';
const SW_URL = `./sw.js?${SW_VERSION}`;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(SW_URL);
      registration.update().catch(() => {});
    } catch (error) {
      console.error('Service worker registration failed', error);
    }
  });
}
