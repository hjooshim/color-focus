chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) {
    sendResponse({ ok: false, reason: "invalid-message" });
    return false;
  }

  if (message.action === "ping") {
    sendResponse({ ok: true, surface: "background" });
    return false;
  }

  sendResponse({ ok: false, reason: "not-ready" });
  return false;
});
