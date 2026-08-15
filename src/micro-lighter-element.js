import { highlightAll } from "./highlight-all.js";

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: grid;
      position: relative;
    }

    ::slotted(pre) {
      grid-area: 1 / 1;
      margin: 0;
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
      grid-area: 1 / 1;
      justify-self: end;
      line-height: 1;
      margin: 0.5rem;
      padding: 0.5rem 0.625rem;
      position: relative;
      z-index: 1;
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
  <button type="button" part="copy-button" hidden>Copy</button>
`;

export class MicroLighter extends HTMLElement {
  static observedAttributes = ["controls", "language"];

  #button;
  #code;
  #languageOverridden = false;
  #observer;
  #originalLanguage;
  #resetCopyLabel;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.append(template.content.cloneNode(true));
    this.#button = shadow.querySelector("button");
    this.#button.addEventListener("click", () => this.#copy());
    shadow.querySelector("slot").addEventListener("slotchange", () => this.#update());
    this.#observer = new MutationObserver(() => this.#update());
  }

  connectedCallback() {
    this.#observer.observe(this, {
      attributeFilter: ["class", "data-language", "lang"],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
    this.#update();
  }

  disconnectedCallback() {
    this.#observer.disconnect();
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

    if (this.#code !== code) {
      this.#restoreLanguage();
      this.#code = code;
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

    if (code) highlightAll();
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