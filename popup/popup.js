const toggleButton = document.getElementById("toggle-button");
const themeSelect = document.getElementById("theme-mode");
const statusText = document.getElementById("status-text");
const RESPONSE_TIMEOUT_MS = 4000;

let currentState = {
  enabled: false,
  supported: true,
  reason: "inactive",
  themeMode: "auto"
};

document.addEventListener("DOMContentLoaded", initializePopup);

async function initializePopup() {
  bindEvents();
  await refreshStatus();
}

function bindEvents() {
  toggleButton.addEventListener("click", async () => {
    setBusy(true);
    const action = currentState.enabled ? "deactivate" : "activate";
    const response = await sendMessage({ action });
    applyState(response);
    setBusy(false);
  });

  themeSelect.addEventListener("change", async (event) => {
    setBusy(true);
    const response = await sendMessage({
      action: "setThemeMode",
      themeMode: event.target.value
    });
    applyState(response);
    setBusy(false);
  });
}

async function refreshStatus() {
  setBusy(true);
  const response = await sendMessage({ action: "getStatus" });
  applyState(response);
  setBusy(false);
}

async function sendMessage(payload) {
  try {
    const response = await Promise.race([sendRuntimeMessage(payload), createTimeoutPromise()]);
    return response || {
      ok: false,
      enabled: currentState.enabled,
      supported: currentState.supported,
      reason: "background-error",
      themeMode: currentState.themeMode
    };
  } catch (error) {
    console.error("Color Focus popup error", error);
    return {
      ok: false,
      enabled: currentState.enabled,
      supported: currentState.supported,
      reason: error && error.message === "popup-timeout" ? "popup-timeout" : "background-error",
      themeMode: currentState.themeMode
    };
  }
}

function createTimeoutPromise() {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("popup-timeout"));
    }, RESPONSE_TIMEOUT_MS);
  });
}

function sendRuntimeMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function applyState(nextState) {
  currentState = {
    ...currentState,
    ...(nextState || {})
  };

  themeSelect.value = currentState.themeMode || "auto";
  themeSelect.disabled = !currentState.supported;
  toggleButton.disabled = !currentState.supported;
  toggleButton.textContent = getButtonCopy(currentState);
  toggleButton.dataset.active = currentState.enabled ? "true" : "false";
  toggleButton.dataset.supported = currentState.supported ? "true" : "false";
  statusText.textContent = getStatusCopy(currentState);
}

function getButtonCopy(state) {
  if (!state.supported) {
    return "Unavailable on This Tab";
  }

  return state.enabled ? "Turn Off for This Tab" : "Turn On for This Tab";
}

function getStatusCopy(state) {
  if (state.reason === "popup-timeout") {
    return "The page took too long to answer. Try clicking again in a moment.";
  }

  if (state.reason === "background-error" || state.reason === "content-error") {
    return "The extension hit an error while talking to this tab.";
  }

  if (!state.supported) {
    return "This tab does not allow Color Focus. Try a regular http or https page.";
  }

  if (state.reason === "non-english") {
    return "This page is marked as non-English, so Color Focus stays off.";
  }

  if (state.reason === "no-readable-text") {
    return "No readable long-form text was detected on this page.";
  }

  if (state.reason === "activating") {
    return "Color Focus is turning on for this tab.";
  }

  if (state.enabled) {
    return "Color Focus is active for this tab only. Reloading the page turns it off.";
  }

  return "Color Focus is off for this tab. Theme mode still persists.";
}

function setBusy(isBusy) {
  document.body.dataset.busy = isBusy ? "true" : "false";

  if (isBusy) {
    toggleButton.disabled = true;
    themeSelect.disabled = true;
  }
}
