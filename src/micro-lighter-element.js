import { highlightAll } from "./highlight-all.js";

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: grid;
      position: relative;
    }

    slot {
      display: contents;
    }

    ::slotted(pre) {
      grid-column: 1 / -1;
      grid-row: 1;
      margin: 0;
    }

    :host([line-numbers]) {
      grid-template-columns: max-content minmax(0, 1fr);
    }

    :host([line-numbers]) ::slotted(pre) {
      border-end-start-radius: 0 !important;
      border-start-start-radius: 0 !important;
      grid-column: 2;
    }

    .line-numbers {
      align-self: stretch;
      background: var(--syntax-background, #fff);
      box-sizing: border-box;
      color: var(--syntax-comment, #6b7280);
      font: 0.875rem / 1.5 monospace;
      font-variant-numeric: tabular-nums;
      grid-column: 1;
      grid-row: 1;
      overflow: hidden;
      padding: 0 0.75rem 1rem;
      pointer-events: none;
      text-align: end;
      user-select: none;
      white-space: pre;
      z-index: 1;
    }

    .line-numbers[hidden] {
      display: none;
    }

    button {
      appearance: none;
      align-self: start;
      background: var(--syntax-background, #fff);
      border: 1px solid var(--syntax-comment, #6b7280);
      border-radius: 0.25rem;
      color: var(--syntax-foreground, #111827);
      cursor: pointer;
      font: inherit;
      font-size: 0.75rem;
      grid-column: 1 / -1;
      grid-row: 1;
      justify-self: end;
      line-height: 1;
      margin: 0.5rem;
      padding: 0.5rem 0.625rem;
      position: relative;
      z-index: 2;
    }

    button:hover {
      border-color: var(--syntax-foreground, #111827);
    }

    button:focus-visible {
      outline: 2px solid var(--syntax-keyword, #2563eb);
      outline-offset: 2px;
    }

    button[hidden] {
      display: none;
    }
  </style>
  <slot></slot>
  <div class="line-numbers" part="line-numbers" aria-hidden="true" hidden></div>
  <button type="button" part="copy-button" hidden>Copy</button>
`;

export class MicroLighter extends HTMLElement {
  static observedAttributes = ["controls", "language", "line-numbers"];

  #button;
  #code;
  #languageOverridden = false;
  #lineNumbers;
  #onResize;
  #observer;
  #originalLanguage;
  #pre;
  #resetCopyLabel;
  #resizeObserver;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.append(template.content.cloneNode(true));
    this.#button = shadow.querySelector("button");
    this.#lineNumbers = shadow.querySelector(".line-numbers");
    this.#button.addEventListener("click", () => this.#copy());
    shadow.querySelector("slot").addEventListener("slotchange", () => this.#update());
    this.#observer = new MutationObserver(() => this.#update());
    this.#onResize = () => this.#alignLineNumbers();
    this.#resizeObserver = new ResizeObserver(() => this.#alignLineNumbers());
  }

  connectedCallback() {
    this.#observer.observe(this, {
      attributeFilter: ["class", "data-language", "lang"],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
    window.addEventListener("resize", this.#onResize);
    this.#update();
  }

  disconnectedCallback() {
    this.#observer.disconnect();
    this.#resizeObserver.disconnect();
    window.removeEventListener("resize", this.#onResize);
    clearTimeout(this.#resetCopyLabel);
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#update();
  }

  async #copy() {
    if (!this.#code) return;

    await navigator.clipboard.writeText(this.#code.textContent);
    this.#button.textContent = "Copied";
    this.#button.ariaNotify?.("Copied to clipboard");

    clearTimeout(this.#resetCopyLabel);
    this.#resetCopyLabel = setTimeout(() => {
      this.#button.textContent = "Copy";
    }, 2000);
  }

  #update() {
    const code = this.querySelector(":scope > pre > code");
    const pre = code?.parentElement;

    if (this.#code !== code) {
      this.#restoreLanguage();
      this.#code = code;
    }

    if (this.#pre !== pre) {
      this.#resizeObserver.disconnect();
      this.#pre = pre;
      if (pre) this.#resizeObserver.observe(pre);
    }

    this.#button.hidden = !this.#hasControl("copy") || !code;

    const language = this.getAttribute("language");
    if (code && language) {
      if (!this.#languageOverridden) {
        this.#originalLanguage = code.getAttribute("data-language");
        this.#languageOverridden = true;
      }
      if (code.dataset.language !== language) code.dataset.language = language;
    } else {
      this.#restoreLanguage();
    }

    this.#updateLineNumbers();

    if (code) highlightAll();
  }

  #updateLineNumbers() {
    if (!this.#code || !this.hasAttribute("line-numbers")) {
      this.#lineNumbers.hidden = true;
      this.#lineNumbers.textContent = "";
      return;
    }

    const lineCount = this.#code.textContent.split(/\r\n?|\n/).length;
    this.#alignLineNumbers();
    this.#lineNumbers.textContent = Array.from(
      { length: lineCount },
      (_, index) => index + 1
    ).join("\n");
    this.#lineNumbers.hidden = false;
  }

  #alignLineNumbers() {
    if (!this.#pre || !this.hasAttribute("line-numbers")) return;
    const preStyle = getComputedStyle(this.#pre);
    this.#lineNumbers.style.lineHeight = preStyle.lineHeight;
    this.#lineNumbers.style.paddingBlockStart = preStyle.paddingBlockStart;
  }

  #hasControl(name) {
    return (this.getAttribute("controls") || "")
      .split(/[\s,]+/)
      .includes(name);
  }

  #restoreLanguage() {
    if (!this.#code || !this.#languageOverridden) return;

    if (this.#originalLanguage === null && this.#code.hasAttribute("data-language")) {
      delete this.#code.dataset.language;
    } else if (
      this.#originalLanguage !== null
      && this.#code.getAttribute("data-language") !== this.#originalLanguage
    ) {
      this.#code.setAttribute("data-language", this.#originalLanguage);
    }
    this.#languageOverridden = false;
  }
}

if (!customElements.get("micro-lighter")) {
  customElements.define("micro-lighter", MicroLighter);
}
