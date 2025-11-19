const extensionApi = typeof browser !== "undefined" ? browser : chrome;
const SETTINGS_KEY = "nnPortfolioRefresherSettings";
const LEGACY_ENABLED_KEY = "nnPortfolioRefresherEnabled";
const LEGACY_INTERVAL_KEY = "nnPortfolioRefresherIntervalSeconds";
const DEFAULT_SETTINGS = { enabled: true, intervalSeconds: 5 };

let currentSettings = { ...DEFAULT_SETTINGS };
let refreshTimer = null;

function callStorage(area, method, args) {
  try {
    if (area[method].length > args.length) {
      return new Promise((resolve, reject) => {
        area[method](...args, value => {
          const error = extensionApi.runtime ? extensionApi.runtime.lastError : null;
          if (error) reject(error);
          else resolve(value);
        });
      });
    }

    const result = area[method](...args);
    if (result && typeof result.then === "function") return result;

    return new Promise((resolve, reject) => {
      area[method](...args, value => {
        const error = extensionApi.runtime ? extensionApi.runtime.lastError : null;
        if (error) reject(error);
        else resolve(value);
      });
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

async function storageGet(keys) {
  const storage = extensionApi.storage;
  if (!storage) throw new Error("Storage API unavailable");

  const areas = [];
  if (storage.local && typeof storage.local.get === "function") areas.push(storage.local);
  if (storage.sync && typeof storage.sync.get === "function") areas.push(storage.sync);

  if (!areas.length) throw new Error("Storage API unavailable");

  let lastError = null;
  for (const area of areas) {
    try {
      return await callStorage(area, "get", [keys]);
    } catch (error) {
      lastError = error;
      console.warn("NN Portfolio Refresher: storage get failed, retrying", error);
    }
  }

  throw lastError || new Error("Storage get failed");
}

async function storageSet(data) {
  const storage = extensionApi.storage;
  if (!storage) throw new Error("Storage API unavailable");

  const areas = [];
  if (storage.local && typeof storage.local.set === "function") areas.push(storage.local);
  if (storage.sync && typeof storage.sync.set === "function") areas.push(storage.sync);

  if (!areas.length) throw new Error("Storage API unavailable");

  let lastError = null;
  for (const area of areas) {
    try {
      await callStorage(area, "set", [data]);
      return;
    } catch (error) {
      lastError = error;
      console.warn("NN Portfolio Refresher: storage set failed, retrying", error);
    }
  }

  throw lastError || new Error("Storage set failed");
}

function normalizeSettings(raw) {
  const normalized = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return normalized;

  if (typeof raw.enabled === "boolean") normalized.enabled = raw.enabled;

  const interval = Number(raw.intervalSeconds);
  if (Number.isFinite(interval) && interval > 0) {
    normalized.intervalSeconds = Math.max(1, Math.floor(interval));
  }

  return normalized;
}

function deriveSettings(data) {
  const fallback = { ...DEFAULT_SETTINGS };
  if (!data) return { settings: fallback, needsPersist: true };

  const stored = data[SETTINGS_KEY];
  if (stored && typeof stored === "object") {
    return { settings: normalizeSettings(stored), needsPersist: false };
  }

  let needsPersist = true;
  if (typeof data[LEGACY_ENABLED_KEY] === "boolean") {
    fallback.enabled = data[LEGACY_ENABLED_KEY];
  }

  const legacyInterval = Number(data[LEGACY_INTERVAL_KEY]);
  if (Number.isFinite(legacyInterval) && legacyInterval > 0) {
    fallback.intervalSeconds = Math.max(1, Math.floor(legacyInterval));
  }

  return { settings: fallback, needsPersist };
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function clickRefreshButton() {
  const target = [...document.querySelectorAll("span.sr-only")]
    .find(el => el.textContent.trim() === "Opdater tabel");
  if (!target) return;

  const button = target.closest("button");
  if (button) button.click();
}

function scheduleRefresh(intervalSeconds) {
  const intervalMs = Math.max(1000, Math.floor(intervalSeconds) * 1000);
  refreshTimer = setInterval(clickRefreshButton, intervalMs);
}

function applySettings(nextSettings) {
  const normalized = normalizeSettings(nextSettings);
  currentSettings = normalized;

  clearRefreshTimer();
  if (!currentSettings.enabled) return;

  clickRefreshButton();
  scheduleRefresh(currentSettings.intervalSeconds);
}

async function initialize() {
  try {
    const data = await storageGet([
      SETTINGS_KEY,
      LEGACY_ENABLED_KEY,
      LEGACY_INTERVAL_KEY
    ]);
    const { settings, needsPersist } = deriveSettings(data);
    currentSettings = settings;

    if (needsPersist) {
      await storageSet({ [SETTINGS_KEY]: currentSettings });
    }

    applySettings(currentSettings);
  } catch (error) {
    console.error("NN Portfolio Refresher: Unable to read settings", error);
    applySettings(DEFAULT_SETTINGS);
  }
}

initialize();

extensionApi.runtime.onMessage.addListener(message => {
  if (message && message.type === "NN_PORTFOLIO_REFRESHER_SETTINGS_CHANGED") {
    applySettings(message.settings);
  }
});
