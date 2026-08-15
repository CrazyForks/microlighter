import { highlight } from "./highlight.js";
import { languageFor, loadGrammars } from "./highlight-all.js";

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
  const codeBlocks = [...root.querySelectorAll(selector)].filter(languageFor);
  const languages = [...new Set(codeBlocks.map(languageFor))]
    .filter(language => /^[a-z0-9_-]+$/.test(language));
  const grammars = await loadGrammars(languages, languageAliases);

  highlight(codeBlocks, code => grammars.byLanguage[languageFor(code)], grammars.byScope);
  return codeBlocks;
};
