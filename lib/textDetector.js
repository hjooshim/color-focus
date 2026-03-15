(function initializeTextDetector() {
  const SKIP_SUBTREE_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "NAV",
    "HEADER",
    "FOOTER",
    "ASIDE",
    "PRE",
    "CODE",
    "KBD",
    "SAMP",
    "SVG",
    "CANVAS",
    "FORM",
    "BUTTON",
    "INPUT",
    "TEXTAREA",
    "SELECT",
    "OPTION",
    "VIDEO",
    "AUDIO",
    "IFRAME"
  ]);
  const BLOCK_TAGS = new Set([
    "P",
    "LI",
    "BLOCKQUOTE",
    "TD",
    "TH",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6"
  ]);
  const CANDIDATE_SELECTOR = "p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6, div";
  const STRUCTURAL_DESCENDANT_SELECTOR =
    "p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6";

  function detectTextBlocks(root, options) {
    const settings = {
      minWords: 20,
      ...(options || {})
    };
    const scopeRoots = getReadableRoots(root);
    const blocks = [];
    const seen = new Set();

    scopeRoots.forEach((scopeRoot) => {
      const candidates = getCandidateNodes(scopeRoot)
        .filter((node) => isCandidateBlock(node, scopeRoot, settings));
      const leafCandidates = candidates.filter(
        (node) => !candidates.some((other) => other !== node && node.contains(other))
      );

      leafCandidates.forEach((node) => {
        if (!seen.has(node)) {
          seen.add(node);
          blocks.push(node);
        }
      });
    });

    return blocks;
  }

  function getCandidateNodes(scopeRoot) {
    const nodes = Array.from(scopeRoot.querySelectorAll(CANDIDATE_SELECTOR));

    if (scopeRoot.matches && scopeRoot.matches(CANDIDATE_SELECTOR)) {
      nodes.unshift(scopeRoot);
    }

    return nodes;
  }

  function getReadableRoots(root) {
    if (!root) {
      return [];
    }

    if (root.nodeType === Node.DOCUMENT_NODE) {
      return getReadableRoots(root.body);
    }

    if (root.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }

    const semanticRoots = Array.from(root.querySelectorAll("article, main")).filter(isUsableElement);
    return semanticRoots.length ? semanticRoots : [root];
  }

  function isCandidateBlock(node, scopeRoot, settings) {
    if (!(node instanceof Element)) {
      return false;
    }

    if (!scopeRoot.contains(node) || node.hasAttribute("data-cr-processed")) {
      return false;
    }

    if (node.querySelector("[data-cr-original='true']")) {
      return false;
    }

    if (!isUsableElement(node) || isInsideBlockedRegion(node, scopeRoot)) {
      return false;
    }

    if (BLOCK_TAGS.has(node.tagName)) {
      return (
        !hasStructuralCandidateAncestor(node, scopeRoot, settings.minWords) &&
        hasEnoughWords(node, settings.minWords)
      );
    }

    if (node.tagName !== "DIV") {
      return false;
    }

    if (hasStructuralChildren(node) || hasStructuralCandidateAncestor(node, scopeRoot, settings.minWords)) {
      return false;
    }

    return hasEnoughWords(node, settings.minWords);
  }

  function hasStructuralChildren(node) {
    return Boolean(node.querySelector(STRUCTURAL_DESCENDANT_SELECTOR));
  }

  function hasStructuralCandidateAncestor(node, scopeRoot, minWords) {
    let current = node.parentElement;

    while (current && current !== scopeRoot) {
      if (BLOCK_TAGS.has(current.tagName)) {
        return true;
      }

      if (current.tagName === "DIV" && !hasStructuralChildren(current) && hasEnoughWords(current, minWords)) {
        return true;
      }

      current = current.parentElement;
    }

    return false;
  }

  function isInsideBlockedRegion(node, scopeRoot) {
    let current = node;

    while (current && current !== scopeRoot) {
      if (!(current instanceof Element)) {
        break;
      }

      if (current !== node && current.hasAttribute("data-cr-processed")) {
        return true;
      }

      if (
        SKIP_SUBTREE_TAGS.has(current.tagName) ||
        current.closest("pre, code, kbd, samp") === current ||
        current.isContentEditable ||
        current.getAttribute("role") === "textbox"
      ) {
        return true;
      }

      current = current.parentElement;
    }

    return false;
  }

  function collectTextNodes(block) {
    if (!(block instanceof Element)) {
      return [];
    }

    const textNodes = [];
    const walker = document.createTreeWalker(
      block,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(textNode) {
          const parent = textNode.parentElement;
          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }

          if (!textNode.textContent || !textNode.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          if (
            parent.closest("[data-cr-original='true'], pre, code, kbd, samp, button, input, textarea, select")
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          if (parent.isContentEditable || !isUsableElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    return textNodes;
  }

  function hasEnoughWords(node, minWords) {
    return countWords(node.innerText || node.textContent || "") >= minWords;
  }

  function countWords(text) {
    const matches = text.trim().match(/[A-Za-z0-9'’-]+/g);
    return matches ? matches.length : 0;
  }

  function isUsableElement(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0 ||
      node.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }

    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    return true;
  }

  globalThis.ColorFocusTextDetector = {
    collectTextNodes,
    countWords,
    detectTextBlocks,
    getReadableRoots
  };
})();
