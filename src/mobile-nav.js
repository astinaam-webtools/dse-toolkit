// This project is served as plain ES modules with no bundler, so avoid bare npm imports.
const capacitorRuntime = window.Capacitor;
const plugins = capacitorRuntime?.Plugins || {};
const appPlugin = plugins.App;
const dialogPlugin = plugins.Dialog;
const isNativePlatform = Boolean(capacitorRuntime?.isNativePlatform?.());

if (!isNativePlatform || !appPlugin?.addListener) {
  console.log('Mobile nav: Web mode or App plugin unavailable, skipping back button handler');
} else {
  console.log('Mobile nav: Running on native platform');

  appPlugin.addListener('backButton', async ({ canGoBack }) => {
    console.log('Back button pressed. canGoBack:', canGoBack, 'Path:', window.location.pathname);

    const path = window.location.pathname;
    const isHome = path === '/' || path.endsWith('index.html') || path.endsWith('/public/index.html');

    if (canGoBack && !isHome) {
      window.history.back();
      return;
    }

    try {
      const result = dialogPlugin?.confirm
        ? await dialogPlugin.confirm({
            title: 'Exit App',
            message: 'Are you sure you want to exit?',
            okButtonTitle: 'Exit',
            cancelButtonTitle: 'Cancel'
          })
        : { value: window.confirm('Are you sure you want to exit?') };

      if (result.value) {
        appPlugin.exitApp?.();
      }
    } catch (error) {
      console.error('Mobile nav exit flow failed:', error);
      if (window.confirm('Are you sure you want to exit?')) {
        appPlugin.exitApp?.();
      }
    }
  });
}
