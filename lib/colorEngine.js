(function initializeColorEngine() {
  function getColorClass(tags) {
    const tagList = Array.isArray(tags) ? tags : [];

    if (tagList.includes("ProperNoun")) {
      return "cr-proper-noun";
    }

    if (tagList.includes("Noun")) {
      return "cr-noun";
    }

    if (tagList.includes("Verb")) {
      return "cr-verb";
    }

    if (tagList.includes("Adjective")) {
      return "cr-adjective";
    }

    if (tagList.includes("Adverb")) {
      return "cr-adverb";
    }

    if (tagList.includes("Value")) {
      return "cr-value";
    }

    if (tagList.includes("Pronoun")) {
      return "cr-pronoun";
    }

    if (tagList.includes("Preposition")) {
      return "cr-preposition";
    }

    if (tagList.includes("Determiner")) {
      return "cr-determiner";
    }

    if (tagList.includes("Conjunction")) {
      return "cr-conjunction";
    }

    return "cr-other";
  }

  function colorBlock(block) {
    const detector = globalThis.ColorFocusTextDetector;
    const textNodes = detector ? detector.collectTextNodes(block) : [];

    if (!textNodes.length) {
      return 0;
    }

    let coloredCount = 0;
    textNodes.forEach((textNode) => {
      if (colorTextNode(textNode)) {
        coloredCount += 1;
      }
    });

    if (coloredCount > 0) {
      block.setAttribute("data-cr-processed", "true");
    }

    return coloredCount;
  }

  function colorTextNode(textNode) {
    if (!textNode || !textNode.parentNode || !textNode.textContent || !textNode.textContent.trim()) {
      return false;
    }

    const fragment = buildFragment(textNode.textContent);
    if (!fragment || !fragment.childNodes.length) {
      return false;
    }

    textNode.parentNode.replaceChild(fragment, textNode);
    return true;
  }

  function buildFragment(text) {
    if (typeof nlp !== "function") {
      return null;
    }

    const fragment = document.createDocumentFragment();
    const sentences = nlp(text).json();

    if (!Array.isArray(sentences) || !sentences.length) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }

    sentences.forEach((sentence) => {
      if (!Array.isArray(sentence.terms) || !sentence.terms.length) {
        if (sentence.text) {
          fragment.appendChild(document.createTextNode(sentence.text));
        }
        return;
      }

      sentence.terms.forEach((term) => {
        const span = document.createElement("span");
        span.className = getColorClass(term.tags);
        span.dataset.crOriginal = "true";
        span.textContent = `${term.pre || ""}${term.text || ""}${term.post || ""}`;
        fragment.appendChild(span);
      });
    });

    return fragment;
  }

  function removeColoring(root) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    const spans = Array.from(scope.querySelectorAll("span[data-cr-original='true']"));
    const normalizedParents = new Set();

    spans.forEach((span) => {
      const parent = span.parentNode;
      if (!parent) {
        return;
      }

      parent.replaceChild(document.createTextNode(span.textContent || ""), span);
      normalizedParents.add(parent);
    });

    normalizedParents.forEach((node) => {
      if (node.normalize) {
        node.normalize();
      }
    });

    const processedBlocks = scope.querySelectorAll("[data-cr-processed='true']");
    processedBlocks.forEach((block) => {
      block.removeAttribute("data-cr-processed");
    });
  }

  globalThis.ColorFocusColorEngine = {
    buildFragment,
    colorBlock,
    colorTextNode,
    getColorClass,
    removeColoring
  };
})();
