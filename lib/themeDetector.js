(function initializeThemeDetector() {
  const THEME_ATTRIBUTE = "data-cr-theme";

  function resolveThemeMode(themeMode, anchorElement) {
    if (themeMode === "light" || themeMode === "dark") {
      return themeMode;
    }

    return detectPageTheme(anchorElement);
  }

  function detectPageTheme(anchorElement) {
    const background = getRelevantBackground(anchorElement);
    if (!background) {
      return "light";
    }

    const { red, green, blue } = background;
    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    return luminance > 0.5 ? "light" : "dark";
  }

  function getRelevantBackground(anchorElement) {
    const start = getAnchorElement(anchorElement);
    const visited = new Set();
    let current = start;

    while (current) {
      const color = parseColor(window.getComputedStyle(current).backgroundColor);
      if (color && !isTransparent(color)) {
        return color;
      }

      visited.add(current);
      current = current.parentElement;
    }

    const fallbacks = [document.body, document.documentElement].filter(Boolean);
    for (const element of fallbacks) {
      if (visited.has(element)) {
        continue;
      }

      const color = parseColor(window.getComputedStyle(element).backgroundColor);
      if (color && !isTransparent(color)) {
        return color;
      }
    }

    return null;
  }

  function getAnchorElement(anchorElement) {
    if (anchorElement instanceof Element) {
      return anchorElement;
    }

    if (document.querySelector("article, main")) {
      return document.querySelector("article, main");
    }

    return document.body || document.documentElement;
  }

  function parseColor(value) {
    if (!value || value === "transparent") {
      return null;
    }

    const match = value.match(/rgba?\(([^)]+)\)/i);
    if (!match) {
      return null;
    }

    const parts = match[1].split(",").map((part) => part.trim());
    if (parts.length < 3) {
      return null;
    }

    const alpha = parts.length > 3 ? Number(parts[3]) : 1;
    return {
      red: Number(parts[0]),
      green: Number(parts[1]),
      blue: Number(parts[2]),
      alpha: Number.isFinite(alpha) ? alpha : 1
    };
  }

  function isTransparent(color) {
    return color.alpha === 0;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }

  function clearTheme() {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  }

  globalThis.ColorFocusThemeDetector = {
    applyTheme,
    clearTheme,
    detectPageTheme,
    resolveThemeMode
  };
})();
