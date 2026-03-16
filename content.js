const state = {
  enabled: false,
  themeMode: "auto"
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error("Color Focus content error", error);
      sendResponse(buildStatus({ ok: false, reason: "content-error", message: String(error) }));
    });

  return true;
});

async function handleMessage(message) {
  if (!message || !message.action) {
    return buildStatus({ ok: false, reason: "invalid-message" });
  }

  if (message.action === "ping") {
    return { ok: true, surface: "content" };
  }

  if (message.action === "getStatus") {
    if (message.themeMode) {
      state.themeMode = normalizeThemeMode(message.themeMode);
    }

    return buildStatus();
  }

  if (message.action === "setThemeMode") {
    state.themeMode = normalizeThemeMode(message.themeMode);
    if (state.enabled) {
      applyTheme(getAnchorElement());
    }

    return buildStatus();
  }

  if (message.action === "activate") {
    state.themeMode = normalizeThemeMode(message.themeMode);
    return activatePage();
  }

  if (message.action === "deactivate") {
    deactivatePage();
    return buildStatus({ reason: "inactive" });
  }

  return buildStatus({ ok: false, reason: "unknown-action" });
}

function activatePage() {
  if (!isSupportedContext()) {
    state.enabled = false;
    return buildStatus({ supported: false, reason: "unsupported-page" });
  }

  if (isExplicitlyNonEnglishDocument()) {
    state.enabled = false;
    return buildStatus({ reason: "non-english" });
  }

  const detector = globalThis.ColorFocusTextDetector;
  const colorEngine = globalThis.ColorFocusColorEngine;
  if (!detector || !colorEngine) {
    state.enabled = false;
    return buildStatus({ ok: false, reason: "missing-engine" });
  }

  colorEngine.removeColoring(document);
  applyTheme(getAnchorElement());

  const blocks = detector.detectTextBlocks(document);
  let coloredBlocks = 0;

  blocks.forEach((block) => {
    coloredBlocks += colorEngine.colorBlock(block);
  });

  state.enabled = coloredBlocks > 0;
  return buildStatus({
    reason: state.enabled ? "active" : "no-readable-text"
  });
}

function deactivatePage() {
  const colorEngine = globalThis.ColorFocusColorEngine;
  const themeDetector = globalThis.ColorFocusThemeDetector;

  if (colorEngine) {
    colorEngine.removeColoring(document);
  }

  if (themeDetector) {
    themeDetector.clearTheme();
  }

  state.enabled = false;
}

function applyTheme(anchorElement) {
  const themeDetector = globalThis.ColorFocusThemeDetector;
  if (!themeDetector) {
    return;
  }

  const theme = themeDetector.resolveThemeMode(state.themeMode, anchorElement);
  themeDetector.applyTheme(theme);
}

function buildStatus(overrides) {
  const base = {
    ok: true,
    enabled: state.enabled,
    supported: isSupportedContext(),
    reason: state.enabled ? "active" : "inactive",
    themeMode: state.themeMode
  };

  if (isExplicitlyNonEnglishDocument()) {
    base.enabled = false;
    base.reason = "non-english";
  }

  return {
    ...base,
    ...(overrides || {})
  };
}

function normalizeThemeMode(themeMode) {
  if (themeMode === "light" || themeMode === "dark") {
    return themeMode;
  }

  return "auto";
}

function isExplicitlyNonEnglishDocument() {
  const lang = document.documentElement.lang;
  return Boolean(lang) && !lang.toLowerCase().startsWith("en");
}

function isSupportedContext() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function getAnchorElement() {
  return document.querySelector("article, main") || document.body || document.documentElement;
}
