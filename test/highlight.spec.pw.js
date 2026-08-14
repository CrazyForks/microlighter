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

    for (const category of ["keyword", "string", "comment", "function", "number"]) {
      expect(categories).toContain(category);
    }
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
