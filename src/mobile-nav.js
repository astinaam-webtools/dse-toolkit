import { App } from '@capacitor/app';
import { Dialog } from '@capacitor/dialog';
import { Capacitor } from '@capacitor/core';

// Only run on native platforms
if (Capacitor.isNativePlatform()) {
  console.log('Mobile nav: Running on native platform');

  // Register the back button listener
  App.addListener('backButton', async ({ canGoBack }) => {
    console.log('Back button pressed. canGoBack:', canGoBack, 'Path:', window.location.pathname);
    
    const path = window.location.pathname;
    // Robust check for home page
    const isHome = path === '/' || path.endsWith('index.html') || path.endsWith('/public/index.html');

    if (canGoBack && !isHome) {
      window.history.back();
    } else {
      // Show exit confirmation
      try {
        const result = await Dialog.confirm({
          title: 'Exit App',
          message: 'Are you sure you want to exit?',
          okButtonTitle: 'Exit',
          cancelButtonTitle: 'Cancel',
        });
        
        if (result.value) {
          App.exitApp();
        }
      } catch (error) {
        console.error('Dialog error:', error);
        // Fallback
        if (window.confirm('Are you sure you want to exit?')) {
          App.exitApp();
        }
      }
    }
  });
} else {
  console.log('Mobile nav: Not on native platform, skipping back button handler');
}
