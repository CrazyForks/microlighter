import { highlight } from "./highlight.js";
import { createGrammarLoader, normalizeLanguage } from "./grammar-dependencies.js";

const getLanguageClass = element => [...element.classList]
  .find(className => className.startsWith("language-"))
  ?.slice("language-".length);

export const getLanguage = code => {
  const pre = code.parentElement;
  const language = getLanguageClass(code)
    || code.dataset.language
    || getLanguageClass(pre)
    || pre.dataset.language
    // Deprecated: `lang` describes human language, not programming language.
    || pre.getAttribute("lang")
    || "";

  return language.toLowerCase();
};
export const loadGrammars = createGrammarLoader();

export const highlightAll = async ({ root = document, selector = "pre > code" } = {}) => {
  const codeBlocks = [...root.querySelectorAll(selector)].filter(getLanguage);
  const language = code => normalizeLanguage(getLanguage(code));
  const languages = [...new Set(codeBlocks.map(language))]
    .filter(language => /^[a-z0-9_-]+$/.test(language));
  const grammars = await loadGrammars(languages);

  highlight(codeBlocks, code => grammars.languages[language(code)], grammars.scopes);
  return codeBlocks;
};
