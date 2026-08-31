export type TelegramWebApp = {
  platform?: string;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

// Telegram is optional: the same game also works in an ordinary browser.
export function initializeTelegram(app?: TelegramWebApp) {
  if (!app || !app.platform || app.platform === 'unknown') return;

  const actions = [
    () => app.ready(),
    () => app.expand(),
    () => {
      if (app.isVersionAtLeast?.('6.1')) app.setBackgroundColor?.('#090806');
    },
    () => {
      if (app.isVersionAtLeast?.('6.9')) app.setHeaderColor?.('#090806');
    },
    () => {
      if (app.isVersionAtLeast?.('7.10')) app.setBottomBarColor?.('#090806');
    },
  ];

  for (const action of actions) {
    try {
      action();
    } catch {
      // Unsupported or unavailable native features must not stop the game.
    }
  }
}
