# MicroLighter

A tiny, dependency-free syntax highlighter for the web. MicroLighter uses the
[CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
and TextMate grammars to colorize code **without** wrapping every token in a
`<span>`. Your markup stays clean; the highlighting lives entirely in the
highlight registry and CSS.

## How it works

Mark up code blocks with a `lang` attribute on the `<pre>`:

```html
<pre lang="javascript"><code>const answer = 42;</code></pre>
```

Then load the module. It scans the page for `pre[lang] > code`, lazily imports
only the grammars it needs, tokenizes each block, and registers ranges with
`CSS.highlights`.

```html
<body data-syntax-theme="github">
<link rel="stylesheet" href="./src/themes/github.css">
<script type="module" src="./src/index.js"></script>
```

To re-highlight after dynamically adding code (e.g. in a SPA), dispatch a
`syntax-highlight` event:

```js
document.dispatchEvent(new Event("syntax-highlight"));
```

## Themes

Themes are plain CSS files that style the highlight pseudo-elements
(`::highlight(keyword)`, `::highlight(string)`, etc.). Load one theme directly
and set its name in `data-syntax-theme` on `<body>` or any containing element:

```html
<body data-syntax-theme="night-owl">
<link rel="stylesheet" href="./src/themes/night-owl.css">
```

Bundled themes:

- `github`
- `vscode-plus`
- `dracula`
- `monokai`
- `night-owl`
- `solarized-light`

## Languages

Grammars ship as ES modules in `src/grammars/` and are loaded on demand:
`bash`, `css`, `html`, `javascript`, `json`, `markdown`, `ruby`, `scss`, `yaml`.
Common aliases (`js`, `ts`, `sh`, `yml`, `rb`, `md`, `sass`, …) resolve
automatically.

## Build

Produce the minified single-file bundle (`microlighter.min.js`):

```sh
npm run build
```

## Demo

Open `demo.html` in a browser (served over HTTP so ES module imports resolve),
for example:

```sh
npx serve .
```

## Prior art

MicroLighter stands on the shoulders of a lot of existing work. The technique of
highlighting code with the [CSS Custom Highlight API][highlight-api] — mapping
token ranges to `Highlight` objects instead of wrapping every token in a
`<span>` — is not new, and neither are TextMate grammars. What MicroLighter adds
is a tiny, dependency-free implementation: it parses [TextMate grammars][tm]
with the browser's native `RegExp` (using the [`d` flag][d-flag] for match
indices) rather than shipping the Oniguruma WASM engine, lazily loads grammars,
and maps scopes onto Prism-style category names.

Foundations and inspiration:

- **[TextMate grammars][tm]** — the grammar format (scopes, `begin`/`end`,
  `patterns`, `repository`, `include`) that MicroLighter interprets. Popularized
  by [TextMate][textmate] and adopted by [VS Code][vscode-grammar], which is
  where most of the community `.tmLanguage.json` grammars come from.
- **[Prism.js][prism]** — the token category vocabulary (`keyword`, `string`,
  `punctuation`, `function`, `tag`, etc.) that themes target via
  `::highlight(...)` mirrors Prism's token class names, so existing Prism themes
  are easy to port.
- **[Shiki][shiki]** — the canonical TextMate-grammar-based highlighter for the
  web (backed by VS Code's Oniguruma tokenizer). MicroLighter trades Shiki's
  accuracy and language coverage for zero dependencies and a smaller footprint.
- **[Bramus Van Damme's "Syntax Highlighting code snippets with Prism and the
  Custom Highlight API"][bramus]** — the 2024 write-up that popularized using the
  Custom Highlight API for syntax highlighting.

Similar projects worth knowing about:

- **[textmate-highlighter][tmh]** — TextMate grammars + VS Code themes with a
  CSS Custom Highlights render target (uses Oniguruma).
- **[syntax-highlight-element][she]** — a web component that pairs Prism.js with
  the Custom Highlight API.
- **[shiki-highlight-api][sha]** — renders Shiki tokens through the Custom
  Highlight API.
- **[syntaxp][syntaxp]** — a minimal auto-detecting highlighter over the Custom
  Highlight API.

[highlight-api]: https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API
[d-flag]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/hasIndices
[tm]: https://macromates.com/manual/en/language_grammars
[textmate]: https://macromates.com/
[vscode-grammar]: https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide
[prism]: https://prismjs.com/
[shiki]: https://shiki.style/
[bramus]: https://www.bram.us/2024/02/18/custom-highlight-api-for-syntax-highlighting/
[tmh]: https://github.com/fabiospampinato/textmate-highlighter
[she]: https://github.com/andreruffert/syntax-highlight-element
[sha]: https://github.com/shiki-highlights/shiki-highlight-api
[syntaxp]: https://meiert.com/en/blog/custom-highlight-api-syntaxp/

## License

[MIT](./LICENSE) © Dave Rupert
