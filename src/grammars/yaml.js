// Reference: Microsoft VS Code (MIT) — https://github.com/microsoft/vscode/blob/main/extensions/yaml/syntaxes/yaml.tmLanguage.json
export default {
  scopeName: "source.yaml",
  patterns: [
    { match: "#.*$", name: "comment.line.number-sign" },
    { match: "^(?:---|\\.\\.\\.)\\s*$|^%YAML\\b.*$", name: "keyword.control.document" },
    { match: "^\\s*(?:-\\s+)?([^#\\s][^\\r\\n:#]*?)(?=\\s*:)", captures: { 1: { name: "entity.name.key" } } },
    { match: "[&*][a-zA-Z_][\\w-]*|![^\\s]+", name: "entity.name.anchor" },
    // Quoted scalars may fold over lines, but only onto more-indented ones, so
    // a stray apostrophe in a plain scalar cannot swallow the rest of the file.
    { match: "(['\"])(?:\\\\.|(?!\\1)[^\\\\\\r\\n]|\\r?\\n[ \\t]+)*\\1", name: "string.quoted" },
    { match: "(?<=:\\s)[|>][-+]?\\s*$", name: "keyword.control.block-scalar" },
    { match: "\\b(?:true|false|yes|no|on|off)\\b", name: "constant.language.boolean" },
    { match: "\\bnull\\b|~", name: "constant.language" },
    { match: "(?<![\\w.-])-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b", name: "constant.numeric" }
  ]
};