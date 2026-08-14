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
      blocks: document.querySelectorAll("pre > code[class*='language-']").length
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
        .filter(range => range.startContainer.parentElement?.closest("code.language-git-diff"))
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

  test("loads every bundled theme without changing highlight ranges", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const before = await readHighlights(page);
    const themes = await page.locator("#theme option").evaluateAll(options =>
      options.map(option => option.value)
    );

    for (const theme of themes) {
      await page.selectOption("#theme", theme);

      const styles = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const code = getComputedStyle(document.querySelector("pre[lang]"));
        return {
          theme: document.documentElement.dataset.syntaxTheme,
          background: root.getPropertyValue("--syntax-background").trim(),
          foreground: root.getPropertyValue("--syntax-foreground").trim(),
          inserted: root.getPropertyValue("--syntax-inserted").trim(),
          deleted: root.getPropertyValue("--syntax-deleted").trim(),
          codeBackground: code.backgroundColor
        };
      });

      expect(styles.theme).toBe(theme);
      expect(styles.background).not.toBe("");
      expect(styles.foreground).not.toBe("");
      expect(styles.inserted).not.toBe("");
      expect(styles.deleted).not.toBe("");
      expect(styles.codeBackground).not.toBe("rgba(0, 0, 0, 0)");
      expect((await readHighlights(page)).total).toBe(before.total);
    }
  });

  test("removes stale ranges when code blocks disappear", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await page.evaluate(() => {
      document.querySelectorAll("pre > code").forEach(code => code.remove());
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
          const code = range.startContainer.parentElement?.closest("pre > code");
          if (code) highlighted.add(code);
        }
      }

      const blocks = [...document.querySelectorAll("pre > code[class*='language-']")]
        .filter(code => code.textContent.trim().length > 0);

      return {
        langs: [...new Set(blocks.map(code => [...code.classList]
          .find(className => className.startsWith("language-"))
          .slice("language-".length)))],
        unhighlighted: blocks
          .filter(code => !highlighted.has(code))
          .map(code => code.className)
      };
    });

    expect(langs).toEqual(expect.arrayContaining(["python", "go", "rust", "typescript"]));
    expect(unhighlighted).toEqual([]);
  });

  test("supports standard classes, data attributes, and deprecated lang attributes", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const highlighted = await page.evaluate(async () => {
      const fixtures = [
        '<pre><code id="class-language" class="example language-js">const classValue = true;</code></pre>',
        '<pre><code id="code-data-language" data-language="json">{"code": true}</code></pre>',
        '<pre data-language="python"><code id="pre-data-language">value = True</code></pre>',
        '<pre lang="ruby"><code id="legacy-lang">legacy = true</code></pre>'
      ];
      document.body.insertAdjacentHTML("beforeend", fixtures.join(""));
      document.dispatchEvent(new Event("syntax-highlight"));
      await new Promise(resolve => setTimeout(resolve, 100));

      const ids = new Set();
      for (const highlight of CSS.highlights.values()) {
        for (const range of highlight) {
          const id = range.startContainer.parentElement?.closest("code")?.id;
          if (id) ids.add(id);
        }
      }
      return [...ids];
    });

    expect(highlighted).toEqual(expect.arrayContaining([
      "class-language",
      "code-data-language",
      "pre-data-language",
      "legacy-lang"
    ]));
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
