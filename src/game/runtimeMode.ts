export type RuntimeMode = 'production' | 'test';

const RUNTIME_MODE_STORAGE_KEY = 'one-more-card-runtime-mode';

let runtimeMode: RuntimeMode = loadRuntimeMode();

export function getRuntimeMode(): RuntimeMode {
  return runtimeMode;
}

export function isTestMode(): boolean {
  return runtimeMode === 'test';
}

export function setRuntimeMode(mode: RuntimeMode): void {
  runtimeMode = import.meta.env.DEV ? mode : 'production';
  try {
    localStorage.setItem(RUNTIME_MODE_STORAGE_KEY, runtimeMode);
  } catch {
    // Embedded or private browser contexts may reject persistent storage.
  }
}

function loadRuntimeMode(): RuntimeMode {
  if (!import.meta.env.DEV) {
    return 'production';
  }

  try {
    return localStorage.getItem(RUNTIME_MODE_STORAGE_KEY) === 'test' ? 'test' : 'production';
  } catch {
    return 'production';
  }
}
