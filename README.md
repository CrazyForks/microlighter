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
<link rel="stylesheet" href="./src/themes/index.css">
<script type="module" src="./src/index.js"></script>
```

To re-highlight after dynamically adding code (e.g. in a SPA), dispatch a
`syntax-highlight` event:

```js
document.dispatchEvent(new Event("syntax-highlight"));
```

## Themes

Themes are plain CSS files that style the highlight pseudo-elements
(`::highlight(keyword)`, `::highlight(string)`, etc.). Switch themes by setting
`data-syntax-theme` on `<html>` and loading the matching stylesheet. Bundled
themes:

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

## License

[MIT](./LICENSE) © Dave Rupert
