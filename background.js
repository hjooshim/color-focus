const DEFAULT_THEME_MODE = "auto";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error("Color Focus background error", error);
      sendResponse({ ok: false, reason: "background-error", message: String(error) });
    });

  return true;
});

async function handleMessage(message) {
  if (!message || !message.action) {
    return { ok: false, reason: "invalid-message" };
  }

  if (message.action === "ping") {
    return { ok: true, surface: "background" };
  }

  if (message.action === "getStatus") {
    const themeMode = await getThemeMode();
    return relayToActiveTab({ action: "getStatus", themeMode }, themeMode);
  }

  if (message.action === "setThemeMode") {
    const themeMode = normalizeThemeMode(message.themeMode);
    await setThemeMode(themeMode);
    return relayToActiveTab({ action: "setThemeMode", themeMode }, themeMode, true);
  }

  if (message.action === "activate" || message.action === "deactivate") {
    const themeMode = await getThemeMode();
    return relayToActiveTab({ action: message.action, themeMode }, themeMode);
  }

  return { ok: false, reason: "unknown-action" };
}

async function relayToActiveTab(payload, themeMode, allowNoReceiver) {
  const tab = await getActiveTab();
  if (!tab || typeof tab.id !== "number") {
    return buildUnsupportedResponse(themeMode, "no-active-tab");
  }

  if (!isSupportedUrl(tab.url)) {
    return buildUnsupportedResponse(themeMode, "unsupported-page");
  }

  try {
    const response = await sendMessageToTab(tab.id, payload);
    if (!response) {
      return buildUnsupportedResponse(themeMode, "no-response");
    }

    return {
      themeMode,
      ...response
    };
  } catch (error) {
    if (allowNoReceiver) {
      return buildUnsupportedResponse(themeMode, "unsupported-page");
    }

    return buildUnsupportedResponse(themeMode, "unsupported-page");
  }
}

function buildUnsupportedResponse(themeMode, reason) {
  return {
    ok: true,
    enabled: false,
    supported: false,
    reason,
    themeMode
  };
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs.length ? tabs[0] : null);
    });
  });
}

function sendMessageToTab(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function getThemeMode() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["themeMode"], (result) => {
      resolve(normalizeThemeMode(result.themeMode));
    });
  });
}

function setThemeMode(themeMode) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ themeMode }, () => resolve());
  });
}

function normalizeThemeMode(themeMode) {
  if (themeMode === "light" || themeMode === "dark") {
    return themeMode;
  }

  return DEFAULT_THEME_MODE;
}

function isSupportedUrl(url) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}
