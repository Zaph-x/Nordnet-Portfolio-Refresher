const extensionApi = typeof browser !== "undefined" ? browser : chrome;
const SETTINGS_KEY = "nnPortfolioRefresherSettings";
const LEGACY_ENABLED_KEY = "nnPortfolioRefresherEnabled";
const LEGACY_INTERVAL_KEY = "nnPortfolioRefresherIntervalSeconds";
const DEFAULT_SETTINGS = { enabled: true, intervalSeconds: 5 };

const toggle = document.getElementById("enabled-toggle");
const intervalInput = document.getElementById("interval-input");
const statusEl = document.getElementById("status");

let currentSettings = { ...DEFAULT_SETTINGS };

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

function runtimeSend(message) {
  const result = extensionApi.runtime.sendMessage(message);
  if (result && typeof result.then === "function") return result;
  return new Promise((resolve, reject) => {
    extensionApi.runtime.sendMessage(message, response => {
      const error = extensionApi.runtime.lastError;
      if (error) reject(error);
      else resolve(response);
    });
  });
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

function setStatus() {
  statusEl.classList.remove("error");
  statusEl.textContent = currentSettings.enabled
    ? `Refreshing every ${currentSettings.intervalSeconds} second${
        currentSettings.intervalSeconds === 1 ? "" : "s"
      }.`
    : "Extension is paused.";
}

function setError(message) {
  statusEl.classList.add("error");
  statusEl.textContent = message;
}

function updateUi() {
  toggle.checked = currentSettings.enabled;
  intervalInput.value = String(currentSettings.intervalSeconds);
}

async function persist(partial) {
  const merged = normalizeSettings({ ...currentSettings, ...partial });
  if (
    merged.enabled === currentSettings.enabled &&
    merged.intervalSeconds === currentSettings.intervalSeconds
  ) {
    updateUi();
    setStatus();
    return;
  }

  try {
    await storageSet({ [SETTINGS_KEY]: merged });
    currentSettings = merged;
    updateUi();
    setStatus();
    await runtimeSend({
      type: "NN_PORTFOLIO_REFRESHER_SETTINGS_CHANGED",
      settings: currentSettings
    }).catch(() => {});
  } catch (error) {
    setError("Could not update the setting. Try again.");
    updateUi();
  }
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

    updateUi();
    setStatus();
  } catch (error) {
    console.error("NN Portfolio Refresher: Unable to load settings", error);
    currentSettings = { ...DEFAULT_SETTINGS };
    updateUi();
    setStatus();
    setError("Using default settings; saves are unavailable in this session.");
  }

  toggle.addEventListener("change", () => {
    persist({ enabled: toggle.checked });
  });

  intervalInput.addEventListener("change", () => {
    const value = Number.parseInt(intervalInput.value, 10);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Please enter a positive number of seconds.");
      updateUi();
      return;
    }
    persist({ intervalSeconds: value });
  });

  intervalInput.addEventListener("input", () => {
    if (statusEl.classList.contains("error")) {
      statusEl.textContent = "";
      statusEl.classList.remove("error");
    }
  });
}

initialize();
