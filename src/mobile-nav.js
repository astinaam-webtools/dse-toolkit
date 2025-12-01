import { App } from '@capacitor/app';
import { Dialog } from '@capacitor/dialog';

App.addListener('backButton', async ({ canGoBack }) => {
  if (canGoBack) {
    window.history.back();
  } else {
    const { value } = await Dialog.confirm({
      title: 'Exit App',
      message: 'Are you sure you want to exit?',
      okButtonTitle: 'Exit',
      cancelButtonTitle: 'Cancel',
    });

    if (value) {
      App.exitApp();
    }
  }
});
