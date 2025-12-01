import { App } from '@capacitor/app';
import { Dialog } from '@capacitor/dialog';

App.addListener('backButton', async ({ canGoBack }) => {
  // Check if we are on the home page (root or index.html)
  const isHome = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');

  if (canGoBack && !isHome) {
    window.history.back();
  } else {
    let shouldExit = false;
    try {
      const { value } = await Dialog.confirm({
        title: 'Exit App',
        message: 'Are you sure you want to exit?',
        okButtonTitle: 'Exit',
        cancelButtonTitle: 'Cancel',
      });
      shouldExit = value;
    } catch (error) {
      console.error('Dialog error:', error);
      // Fallback to native window confirm if Dialog plugin fails
      shouldExit = window.confirm('Are you sure you want to exit?');
    }

    if (shouldExit) {
      App.exitApp();
    }
  }
});
