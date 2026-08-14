import { test, expect } from "@playwright/test";

/**
 * Read the live CSS Custom Highlight registry state from the page.
 */
const readHighlights = page =>
  page.evaluate(() => {
    let total = 0;
    for (const highlight of CSS.highlights.values()) total += highlight.size;
    return {
      categories: [...CSS.highlights.keys()].sort(),
      total,
      blocks: document.querySelectorAll("pre[lang] > code").length
    };
  });

test.describe("MicroLighter demo site (docs/index.html)", () => {
  test("registers highlight ranges across every code block", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const { categories, total, blocks } = await readHighlights(page);

    expect(blocks).toBeGreaterThan(0);
    expect(categories.length).toBeGreaterThan(10);
    expect(total).toBeGreaterThan(100);
  });

  test("exposes the core token categories", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const { categories } = await readHighlights(page);

    for (const category of ["keyword", "string", "comment", "function", "numeric"]) {
      expect(categories).toContain(category);
    }
  });

  test("maps TextMate scopes to stable semantic categories", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const actual = await page.evaluate(async () => {
      const { highlight } = await import("/microlighter/highlight.js");
      const mappings = [
        ["comment.block.html", "comment"],
        ["markup.quote", "quote"],
        ["markup.inserted.diff", "inserted"],
        ["markup.deleted.diff", "deleted"],
        ["constant.character.entity", "character-entity"],
        ["keyword.control.doctype", "doctype"],
        ["keyword.control.at-rule", "at-rule"],
        ["keyword.other.important", "important"],
        ["entity.name.section", "section"],
        ["string.regexp", "regexp"],
        ["string.quoted.attribute-value", "attribute-value"],
        ["string.other.link", "link"],
        ["markup.raw", "raw"],
        ["string.unquoted.fenced-code", "string"],
        ["constant.numeric.line-number.diff", "numeric"],
        ["constant.language.boolean", "boolean"],
        ["constant.other.symbol", "symbol"],
        ["constant.language", "constant"],
        ["keyword.operator", "operator"],
        ["storage.type", "storage"],
        ["keyword.control.ts", "keyword"],
        ["support.class.builtin", "support"],
        ["entity.name.type.class", "type"],
        ["entity.name.function.macro", "function"],
        ["entity.name.decorator", "decorator"],
        ["entity.name.animation", "animation"],
        ["entity.name.variable.assignment", "variable"],
        ["entity.name.interpolation", "interpolation"],
        ["support.type.property-name", "property"],
        ["entity.name.key", "key"],
        ["entity.name.tag", "tag"],
        ["entity.other.attribute-name", "attribute-name"],
        ["entity.name.selector", "selector"],
        ["punctuation.definition.string.begin", "punctuation"],
        ["entity.name.anchor", "anchor"]
      ];
      const tokens = mappings.map((_, index) => `@${index}`);
      const code = document.createElement("code");
      code.textContent = tokens.join(" ");
      document.body.append(code);

      for (const category of CSS.highlights.keys()) CSS.highlights.delete(category);

      const grammar = {
        scopeName: "source.test",
        patterns: mappings.map(([scope], index) => ({
          match: `${tokens[index]}\\b`,
          name: scope
        }))
      };
      highlight([code], () => grammar, new Map());

      return Object.fromEntries(
        [...CSS.highlights].map(([category, ranges]) => [
          category,
          [...ranges].map(range => range.toString())
        ])
      );
    });

    const expected = {
      comment: ["@0"],
      quote: ["@1"],
      inserted: ["@2"],
      deleted: ["@3"],
      "character-entity": ["@4"],
      doctype: ["@5"],
      "at-rule": ["@6"],
      important: ["@7"],
      section: ["@8"],
      regexp: ["@9"],
      "attribute-value": ["@10"],
      link: ["@11"],
      raw: ["@12"],
      string: ["@13"],
      numeric: ["@14"],
      boolean: ["@15"],
      symbol: ["@16"],
      constant: ["@17"],
      operator: ["@18"],
      storage: ["@19"],
      keyword: ["@20"],
      support: ["@21"],
      type: ["@22"],
      function: ["@23"],
      decorator: ["@24"],
      animation: ["@25"],
      variable: ["@26"],
      interpolation: ["@27"],
      property: ["@28"],
      key: ["@29"],
      tag: ["@30"],
      "attribute-name": ["@31"],
      selector: ["@32"],
      punctuation: ["@33"],
      anchor: ["@34"]
    };

    expect(actual).toEqual(expected);
  });

  test("highlights inserted and deleted git diff lines", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const diffHighlights = await page.evaluate(() => {
      const linesFor = category => [...CSS.highlights.get(category) ?? []]
        .filter(range => range.startContainer.parentElement?.closest("pre[lang='git-diff']"))
        .map(range => range.toString());

      return {
        inserted: linesFor("inserted"),
        deleted: linesFor("deleted"),
        keywords: linesFor("keyword")
      };
    });

    expect(diffHighlights.inserted).toEqual(expect.arrayContaining([
      '+  diff: "git-diff",',
      '+  html: "html",'
    ]));
    expect(diffHighlights.deleted).toContain('-  htm: "html",');
    expect(diffHighlights.keywords).toEqual([]);
  });

  test("re-highlights after switching themes via the syntax-highlight event", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const before = await readHighlights(page);

    await page.evaluate(() => {
      document.documentElement.dataset.syntaxTheme = "dracula";
      document.dispatchEvent(new Event("syntax-highlight"));
    });
    await page.waitForTimeout(200);

    const theme = await page.evaluate(() => document.documentElement.dataset.syntaxTheme);
    const after = await readHighlights(page);

    expect(theme).toBe("dracula");
    expect(after.total).toBe(before.total);
  });

  test("removes stale ranges when code blocks disappear", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await page.evaluate(() => {
      document.querySelectorAll("pre[lang] > code").forEach(code => code.remove());
      document.dispatchEvent(new Event("syntax-highlight"));
    });

    await expect.poll(() => readHighlights(page)).toMatchObject({
      categories: [],
      total: 0
    });
  });

  test("highlights every non-empty code block, including python, go, rust, and typescript", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const { langs, unhighlighted } = await page.evaluate(() => {
      const highlighted = new Set();
      for (const highlight of CSS.highlights.values()) {
        for (const range of highlight) {
          const code = range.startContainer.parentElement?.closest("pre[lang] > code");
          if (code) highlighted.add(code);
        }
      }

      const blocks = [...document.querySelectorAll("pre[lang] > code")]
        .filter(code => code.textContent.trim().length > 0);

      return {
        langs: [...new Set(blocks.map(code => code.parentElement.getAttribute("lang")))],
        unhighlighted: blocks
          .filter(code => !highlighted.has(code))
          .map(code => code.parentElement.getAttribute("lang"))
      };
    });

    expect(langs).toEqual(expect.arrayContaining(["python", "go", "rust", "typescript"]));
    expect(unhighlighted).toEqual([]);
  });

  test("loads without runtime errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    page.on("console", message => {
      if (message.type() !== "error") return;
      // Ignore the harmless missing-favicon request the demo makes; its URL
      // lives on the message location, not in the generic error text.
      const url = message.location()?.url ?? "";
      if (/favicon\.ico/.test(url) || /favicon\.ico/.test(message.text())) return;
      errors.push(message.text());
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    expect(errors).toEqual([]);
  });
});
