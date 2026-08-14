import assert from "node:assert/strict";
import test from "node:test";

import {
  createGrammarLoader,
  externalLanguagesFor,
  normalizeLanguage
} from "../src/grammar-dependencies.js";
import html from "../src/grammars/html.js";
import markdown from "../src/grammars/markdown.js";
import scss from "../src/grammars/scss.js";
import typescript from "../src/grammars/typescript.js";

test("finds external grammar languages in nested rules", () => {
  const grammar = {
    patterns: [
      { include: "#comments" },
      { include: "$self" },
      { include: "source.js#strings" }
    ],
    repository: {
      frontMatter: {
        patterns: [
          { include: "source.yaml" },
          { include: "source.js#comments" }
        ]
      }
    }
  };

  assert.deepEqual([...externalLanguagesFor(grammar)], ["javascript", "yaml"]);
});

test("recognizes source and text scopes but ignores unsupported includes", () => {
  const grammar = {
    patterns: [
      { include: "text.html#tags" },
      { include: "source.css" },
      { include: "meta.embedded.block" }
    ]
  };

  assert.deepEqual([...externalLanguagesFor(grammar)], ["html", "css"]);
});

test("normalizes language aliases and preserves canonical names", () => {
  assert.equal(normalizeLanguage("js"), "javascript");
  assert.equal(normalizeLanguage("yml"), "yaml");
  assert.equal(normalizeLanguage("python"), "python");
});

test("reports dependencies used by the shipped grammars", () => {
  assert.deepEqual([...externalLanguagesFor(scss)], ["css"]);
  assert.deepEqual([...externalLanguagesFor(markdown)], ["yaml"]);
  assert.deepEqual([...externalLanguagesFor(typescript)], ["javascript"]);
  assert.deepEqual([...externalLanguagesFor(html)], ["css", "json", "javascript"]);
});

test("loads external dependencies once and indexes grammars by language and scope", async () => {
  const grammarFixtures = {
    html: {
      scopeName: "text.html",
      patterns: [{ include: "source.js" }]
    },
    javascript: {
      scopeName: "source.js",
      patterns: []
    }
  };
  const importedLanguages = [];
  const load = createGrammarLoader(async language => {
    importedLanguages.push(language);
    return grammarFixtures[language] ?? null;
  });

  const loaded = await load(["html"]);
  await load(["html"]);

  assert.deepEqual(importedLanguages, ["html", "javascript"]);
  assert.deepEqual(loaded.byLanguage, grammarFixtures);
  assert.equal(loaded.byScope.get("text.html"), grammarFixtures.html);
  assert.equal(loaded.byScope.get("source.js"), grammarFixtures.javascript);
});
