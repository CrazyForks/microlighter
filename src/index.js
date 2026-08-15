import { highlight } from "./highlight.js";
import { getLanguage, loadGrammars } from "./highlight-all.js";
import { normalizeLanguage } from "./grammar-dependencies.js";

/**
 * Scan the DOM for code blocks, lazily load the grammars they need, and
 * register CSS Custom Highlight ranges. Side effects happen only when called.
 *
 * @param {Object} [options]
 * @param {ParentNode} [options.root=document] Root to query within.
 * @param {string} [options.selector] Code block selector.
 * @param {Object<string, string>} [options.languageAliases] Custom aliases
 * mapping code block language names to shipped grammar names.
 * @returns {Promise<HTMLElement[]>} The highlighted code elements.
 */
export const highlightAll = async ({
  root = document,
  selector = "pre > code",
  languageAliases
} = {}) => {
  const codeBlocks = [...root.querySelectorAll(selector)].filter(getLanguage);
  const language = code => normalizeLanguage(getLanguage(code), languageAliases);
  const languages = [...new Set(codeBlocks.map(language))]
    .filter(language => /^[a-z0-9_-]+$/.test(language));
  const grammars = await loadGrammars(languages);

  highlight(codeBlocks, code => grammars.languages[language(code)], grammars.scopes);
  return codeBlocks;
};
