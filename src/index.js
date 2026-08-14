import { highlight } from "./highlight.js";
import { createGrammarLoader, normalizeLanguage } from "./grammar-dependencies.js";

/**
 * Read and normalize the language declared by a code block's parent element.
 * @param {HTMLElement} code
 * @returns {string}
 */
const languageFor = code => {
  return normalizeLanguage(code.parentElement.lang.toLowerCase());
};

const loadGrammars = createGrammarLoader();

/**
 * Scan the DOM for code blocks, lazily load the grammars they need, and
 * register CSS Custom Highlight ranges. Side effects happen only when called.
 *
 * @param {Object} [options]
 * @param {ParentNode} [options.root=document] Root to query within.
 * @param {string} [options.selector="pre[lang] > code"] Code block selector.
 * @returns {Promise<HTMLElement[]>} The highlighted code elements.
 */
export const highlightAll = async ({ root = document, selector = "pre[lang] > code" } = {}) => {
  const codeBlocks = [...root.querySelectorAll(selector)];
  const languages = [...new Set(codeBlocks.map(languageFor))]
    .filter(language => /^[a-z0-9_-]+$/.test(language));
  const grammars = await loadGrammars(languages);

  highlight(codeBlocks, code => grammars.byLanguage[languageFor(code)], grammars.byScope);
  return codeBlocks;
};
