const state = {
  enabled: false,
  themeMode: "auto",
  generation: 0,
  observer: null,
  observerTimer: null,
  pendingRoots: new Set(),
  processingQueue: Promise.resolve()
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

async function activatePage() {
  if (!isSupportedContext()) {
    resetRuntimeState();
    return buildStatus({ supported: false, reason: "unsupported-page" });
  }

  if (isExplicitlyNonEnglishDocument()) {
    resetRuntimeState();
    return buildStatus({ reason: "non-english" });
  }

  const detector = globalThis.ColorFocusTextDetector;
  const colorEngine = globalThis.ColorFocusColorEngine;
  if (!detector || !colorEngine) {
    resetRuntimeState();
    return buildStatus({ ok: false, reason: "missing-engine" });
  }

  const generation = beginActivation();
  colorEngine.removeColoring(document);
  applyTheme(getAnchorElement());

  const blocks = detector.detectTextBlocks(document);
  const coloredBlocks = await processBlocks(blocks, generation);

  if (generation !== state.generation) {
    return buildStatus({ reason: "inactive" });
  }

  state.enabled = coloredBlocks > 0;
  if (state.enabled) {
    startObserving(generation);
  } else {
    const themeDetector = globalThis.ColorFocusThemeDetector;
    if (themeDetector) {
      themeDetector.clearTheme();
    }
  }

  return buildStatus({
    reason: state.enabled ? "active" : "no-readable-text"
  });
}

function deactivatePage() {
  state.generation += 1;
  stopObserving();
  state.pendingRoots.clear();

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

function beginActivation() {
  state.generation += 1;
  state.enabled = false;
  stopObserving();
  state.pendingRoots.clear();
  return state.generation;
}

async function processBlocks(blocks, generation) {
  const colorEngine = globalThis.ColorFocusColorEngine;
  const safeBlocks = dedupeBlocks(blocks).filter((block) => document.contains(block));
  const chunkSize = 5;
  let coloredBlocks = 0;

  for (let index = 0; index < safeBlocks.length; index += chunkSize) {
    if (generation !== state.generation) {
      return coloredBlocks;
    }

    const chunk = safeBlocks.slice(index, index + chunkSize);
    chunk.forEach((block) => {
      coloredBlocks += colorEngine.colorBlock(block);
    });

    if (index + chunkSize < safeBlocks.length) {
      await yieldToMain();
    }
  }

  return coloredBlocks;
}

function startObserving(generation) {
  if (!document.body) {
    return;
  }

  stopObserving();
  state.observer = new MutationObserver((mutations) => {
    if (!state.enabled || generation !== state.generation) {
      return;
    }

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        const root = getProcessableRoot(node);
        if (root) {
          state.pendingRoots.add(root);
        }
      });
    });

    if (!state.pendingRoots.size) {
      return;
    }

    if (state.observerTimer) {
      clearTimeout(state.observerTimer);
    }

    state.observerTimer = window.setTimeout(() => {
      const roots = Array.from(state.pendingRoots);
      state.pendingRoots.clear();

      queueProcessing(async () => {
        if (!state.enabled || generation !== state.generation) {
          return;
        }

        const detector = globalThis.ColorFocusTextDetector;
        const discoveredBlocks = [];

        roots.forEach((root) => {
          discoveredBlocks.push(...detector.detectTextBlocks(root));
        });

        await processBlocks(discoveredBlocks, generation);
      });
    }, 200);
  });

  state.observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function stopObserving() {
  if (state.observerTimer) {
    clearTimeout(state.observerTimer);
    state.observerTimer = null;
  }

  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }
}

function queueProcessing(task) {
  state.processingQueue = state.processingQueue
    .then(task)
    .catch((error) => {
      console.error("Color Focus queued processing error", error);
    });

  return state.processingQueue;
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

function getProcessableRoot(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.parentElement;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  if (
    node.hasAttribute("data-cr-processed") ||
    node.hasAttribute("data-cr-original") ||
    node.closest("[data-cr-original='true']")
  ) {
    return null;
  }

  return node;
}

function dedupeBlocks(blocks) {
  const unique = [];
  const seen = new Set();

  blocks.forEach((block) => {
    if (!block || seen.has(block)) {
      return;
    }

    seen.add(block);
    unique.push(block);
  });

  return unique;
}

function yieldToMain() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function resetRuntimeState() {
  deactivatePage();
}
