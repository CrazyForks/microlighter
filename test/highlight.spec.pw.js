import { readdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

const HOMEPAGE = "/docs/";

const canonicalGrammars = readdirSync(new URL("../src/grammars", import.meta.url))
  .map(file => file.replace(/\.js$/, ""))
  .sort();

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
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    const { categories, total, blocks } = await readHighlights(page);

    expect(blocks).toBeGreaterThan(0);
    expect(categories.length).toBeGreaterThan(10);
    expect(total).toBeGreaterThan(100);
  });

  test("exposes the core token categories", async ({ page }) => {
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    const { categories } = await readHighlights(page);

    for (const category of ["keyword", "string", "comment", "function", "number"]) {
      expect(categories).toContain(category);
    }
  });

  test("re-highlights after switching themes via the syntax-highlight event", async ({ page }) => {
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

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
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    await page.evaluate(() => {
      document.querySelectorAll("pre[lang] > code").forEach(code => code.remove());
      document.dispatchEvent(new Event("syntax-highlight"));
    });

    await expect.poll(() => readHighlights(page)).toMatchObject({
      categories: [],
      total: 0
    });
  });

  test("curates exactly six full static language samples", async ({ page }) => {
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    const sampleLanguages = await page.evaluate(() =>
      [...document.querySelectorAll("section.sample:not(.playground) > pre[lang]")]
        .map(pre => pre.getAttribute("lang")));

    expect(sampleLanguages).toEqual(["html", "markdown", "python", "sql", "cpp", "tsx"]);
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

    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    expect(errors).toEqual([]);
  });
});

test.describe("Supported languages index", () => {
  test("lists every canonical grammar grouped by category", async ({ page }) => {
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    const listed = await page.evaluate(() =>
      [...document.querySelectorAll(".language-index [data-lang]")].map(item => item.dataset.lang));

    expect(listed.sort()).toEqual(canonicalGrammars);
    expect(new Set(listed).size).toBe(listed.length);
  });

  test("organizes languages into meaningful, labeled groups", async ({ page }) => {
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    const groups = await page.evaluate(() =>
      [...document.querySelectorAll(".language-group")].map(group => ({
        name: group.querySelector("h3")?.textContent.trim(),
        languages: [...group.querySelectorAll("[data-lang]")].map(item => item.dataset.lang)
      })));

    const byName = Object.fromEntries(groups.map(group => [group.name, group.languages]));

    expect(Object.keys(byName).length).toBeGreaterThanOrEqual(4);
    // Formats and markup/styling languages aren't shoved into "programming".
    expect(byName["Web"]).toEqual(expect.arrayContaining(["html", "css", "scss"]));
    expect(byName["Data, config & docs"]).toEqual(expect.arrayContaining(["git-diff", "toml", "yaml"]));
  });
});

test.describe("Language playground", () => {
  test("defaults to a language not already shown as a static sample", async ({ page }) => {
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    const staticSamples = ["html", "markdown", "python", "sql", "cpp", "tsx"];
    const selected = await page.locator("#playground-language").inputValue();

    expect(staticSamples).not.toContain(selected);

    const renderedLang = await page.locator("#playground-output pre[lang]").getAttribute("lang");
    expect(renderedLang).toBe(selected);
  });

  test("keeps every language sample inert until selected", async ({ page }) => {
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    const { liveCount, templateCount, templatesInLiveDom } = await page.evaluate(() => ({
      liveCount: document.querySelectorAll("#playground-output pre[lang]").length,
      templateCount: document.querySelectorAll(".playground-body > template").length,
      // Template contents never render into the live document by themselves.
      templatesInLiveDom: document.querySelectorAll(".playground-body > template pre").length
    }));

    expect(liveCount).toBe(1);
    expect(templateCount).toBeGreaterThan(10);
    expect(templatesInLiveDom).toBe(0);
  });

  test("renders exactly one sample at a time and lazily highlights the new selection", async ({ page }) => {
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    await page.selectOption("#playground-language", "rust");
    await expect(page.locator("#playground-output pre[lang]")).toHaveCount(1);
    await expect(page.locator("#playground-output pre[lang='rust']")).toHaveCount(1);

    const rustHighlighted = await page.evaluate(() => {
      const code = document.querySelector("#playground-output pre[lang='rust'] > code");
      for (const highlight of CSS.highlights.values()) {
        for (const range of highlight) {
          if (range.startContainer.parentElement?.closest("#playground-output pre > code") === code) return true;
        }
      }
      return false;
    });
    expect(rustHighlighted).toBe(true);

    await page.selectOption("#playground-language", "yaml");
    await expect(page.locator("#playground-output pre[lang]")).toHaveCount(1);
    await expect(page.locator("#playground-output pre[lang='yaml']")).toHaveCount(1);
    await expect(page.locator("#playground-output pre[lang='rust']")).toHaveCount(0);
  });

  test("select options cover every canonical grammar with a readable label", async ({ page }) => {
    await page.goto(HOMEPAGE, { waitUntil: "networkidle" });

    const options = await page.evaluate(() =>
      [...document.querySelectorAll("#playground-language option")].map(option => ({
        value: option.value,
        label: option.textContent.trim()
      })));

    expect(options.map(option => option.value).sort()).toEqual(canonicalGrammars);
    expect(options.every(option => option.label.length > 0)).toBe(true);
  });
});
