const PREFIX = '[MoneyCalendar]';

function timestamp() {
  return new Date().toISOString();
}

/** Logs visibles dans le terminal Metro (Expo) quand le téléphone est connecté. */
export const log = {
  info: (tag: string, message: string, data?: unknown) => {
    if (data !== undefined) {
      console.log(`${PREFIX} [${tag}] ${timestamp()} — ${message}`, data);
    } else {
      console.log(`${PREFIX} [${tag}] ${timestamp()} — ${message}`);
    }
  },
  warn: (tag: string, message: string, data?: unknown) => {
    if (data !== undefined) {
      console.warn(`${PREFIX} [${tag}] ${timestamp()} — ${message}`, data);
    } else {
      console.warn(`${PREFIX} [${tag}] ${timestamp()} — ${message}`);
    }
  },
  error: (tag: string, message: string, data?: unknown) => {
    if (data !== undefined) {
      console.error(`${PREFIX} [${tag}] ${timestamp()} — ${message}`, data);
    } else {
      console.error(`${PREFIX} [${tag}] ${timestamp()} — ${message}`);
    }
  },
};
