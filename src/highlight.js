/**
 * Highlight sets retained between scans so stale registered ranges can be
 * removed before replacements are created.
 * @type {Map<string, Highlight>}
 */
const highlights = new Map();

/**
 * Convert TextMate grammar matches into CSS Custom Highlight ranges.
 * @param {HTMLElement[]} blocks Code elements containing one text node each.
 * @param {(code: HTMLElement) => Object | undefined} grammarFor Grammar lookup.
 * @param {Map<string, Object>} grammarsByScope External include lookup.
 * @returns {void}
 */
export const highlight = (blocks, grammarFor, grammarsByScope) => {
  const regexes = new Map();

  highlights.forEach((ranges, category) => {
    if (CSS.highlights.get(category) === ranges) CSS.highlights.delete(category);
    ranges.clear();
  });

  /**
   * Flatten a TextMate scope to a stable semantic CSS highlight category.
   * @param {string} scope
   * @returns {string | undefined}
   */
  const categoryFor = scope => {
    const parts = scope.split(".");
    const [first, second, third] = parts;
    const last = parts.at(-1);

    if (first === "markup" && ["quote", "inserted", "deleted", "raw"].includes(second)) return second;
    if (first === "entity" && second === "name") return third;
    if (scope.startsWith("constant.character.entity")) return "character-entity";
    if (parts.includes("numeric")) return "numeric";
    if (scope.startsWith("support.type.property-name")) return "property";
    if (parts.includes("attribute-value")) return "attribute-value";
    if (scope.startsWith("string.other.link")) return "link";

    if ([
      "doctype", "at-rule", "important", "regexp", "boolean",
      "symbol", "operator", "attribute-name"
    ].includes(last)) return last;

    if ([
      "comment", "string", "constant", "storage", "keyword",
      "variable", "punctuation", "entity", "support"
    ].includes(first)) return first;
  };

  /**
   * Register a matched text span under its CSS highlight category.
   * @param {Text} node
   * @param {number} start
   * @param {number} end
   * @param {string} scope
   * @returns {void}
   */
  const addRange = (node, start, end, scope) => {
    const category = categoryFor(scope);
    if (!category || start === end) return;

    const range = new Range();
    range.setStart(node, start);
    range.setEnd(node, end);

    if (!highlights.has(category)) highlights.set(category, new Highlight());
    highlights.get(category).add(range);
  };

  /**
   * Add named capture-group spans from a TextMate rule match.
   * @param {Text} node
   * @param {RegExpExecArray} match
   * @param {Object<string, {name: string}>} [captures]
   * @returns {void}
   */
  const addCaptures = (node, match, captures = {}) => {
    Object.entries(captures).forEach(([index, capture]) => {
      const offsets = match.indices[index];
      if (offsets) addRange(node, ...offsets, capture.name);
    });
  };

  /**
   * Escape text before inserting it into a regular expression.
   * @param {string} value
   * @returns {string}
   */
  const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /**
   * Replace TextMate end-pattern backreferences with escaped begin captures.
   * @param {string} pattern
   * @param {RegExpExecArray} beginMatch
   * @returns {string}
   */
  const expandEnd = (pattern, beginMatch) => pattern.replace(/\\(\d+)/g, (reference, index) => {
    return beginMatch[index] === undefined ? reference : escapeRegex(beginMatch[index]);
  });

  /**
   * Find the next bounded match while reusing compiled grammar expressions.
   * @param {string} pattern
   * @param {Text} node
   * @param {number} start
   * @param {number} end
   * @returns {RegExpExecArray | null}
   */
  const exec = (pattern, node, start, end) => {
    if (!regexes.has(pattern)) regexes.set(pattern, new RegExp(pattern, "dgm"));
    const regex = regexes.get(pattern);
    regex.lastIndex = start;
    const match = regex.exec(node.data);
    return match && match.indices[0][0] < end && match.indices[0][1] <= end ? match : null;
  };

  /**
   * Normalize a grammar rule or repository entry to a rule array.
   * @param {*} rule
   * @returns {Object[]}
   */
  const rulesFor = rule => {
    if (!rule) return [];
    if (Array.isArray(rule)) return rule;
    if (rule.match || rule.begin || rule.include) return [rule];
    return rule.patterns || [];
  };

  /**
   * Resolve local, base, and external TextMate include references.
   * @param {string} include
   * @param {Object} grammar
   * @param {Object} baseGrammar
   * @returns {{grammar: Object, rules: Object[]} | null}
   */
  const resolveInclude = (include, grammar, baseGrammar) => {
    if (include === "$self") return { grammar, rules: grammar.patterns };
    if (include === "$base") return { grammar: baseGrammar, rules: baseGrammar.patterns };

    if (include.startsWith("#")) {
      return { grammar, rules: rulesFor(grammar.repository?.[include.slice(1)]) };
    }

    const [scopeName, repositoryName] = include.split("#");
    const includedGrammar = grammarsByScope.get(scopeName);
    if (!includedGrammar) return null;

    return {
      grammar: includedGrammar,
      rules: repositoryName
        ? rulesFor(includedGrammar.repository?.[repositoryName])
        : includedGrammar.patterns
    };
  };

  /**
   * Expand include rules into directly matchable rule contexts.
   * @param {Object[]} rules
   * @param {Object} grammar
   * @param {Object} baseGrammar
   * @param {Set<string>} [activeIncludes]
   * @returns {{grammar: Object, rule: Object}[]}
   */
  const expandRules = (rules, grammar, baseGrammar, activeIncludes = new Set()) => {
    const expanded = [];

    rules.forEach(rule => {
      if (rule.include) {
        const includeKey = `${grammar.scopeName}:${rule.include}`;
        if (activeIncludes.has(includeKey)) return;

        const included = resolveInclude(rule.include, grammar, baseGrammar);
        if (!included) return;

        const nestedIncludes = new Set(activeIncludes);
        nestedIncludes.add(includeKey);
        expanded.push(...expandRules(included.rules, included.grammar, baseGrammar, nestedIncludes));
        return;
      }

      if (rule.match || (rule.begin && rule.end)) expanded.push({ grammar, rule });
    });

    return expanded;
  };

  /**
   * Select the rule with the earliest match in a text region.
   * @param {Text} node
   * @param {{grammar: Object, rule: Object}[]} contexts
   * @param {number} start
   * @param {number} end
   * @returns {{grammar: Object, rule: Object, match: RegExpExecArray} | null}
   */
  const nextRule = (node, contexts, start, end) => {
    let winner = null;

    contexts.forEach(context => {
      const pattern = context.rule.match || context.rule.begin;
      const match = exec(pattern, node, start, end);
      if (!match) return;

      if (!winner || match.indices[0][0] < winner.match.indices[0][0]) {
        winner = { ...context, match };
      }
    });

    return winner;
  };

  /**
   * Scan a bounded text region, recursively handling begin/end rule pairs.
   * @param {Text} node
   * @param {Object[]} rules
   * @param {number} start
   * @param {number} end
   * @param {Object} grammar
   * @param {Object} [baseGrammar]
   * @param {{pattern: string, applyEndPatternLast?: boolean} | null} [closing]
   * @returns {{contentEnd: number, end: number, match: RegExpExecArray | null}}
   */
  const scanRegion = (node, rules, start, end, grammar, baseGrammar = grammar, closing = null) => {
    const contexts = expandRules(rules, grammar, baseGrammar);
    let cursor = start;

    while (cursor < end) {
      const candidate = nextRule(node, contexts, cursor, end);
      const endMatch = closing ? exec(closing.pattern, node, cursor, end) : null;
      const candidateStart = candidate?.match.indices[0][0] ?? Infinity;
      const endStart = endMatch?.indices[0][0] ?? Infinity;

      if (endMatch && (endStart < candidateStart || (endStart === candidateStart && !closing.applyEndPatternLast))) {
        return { contentEnd: endStart, end: endMatch.indices[0][1], match: endMatch };
      }

      if (!candidate) return { contentEnd: end, end, match: null };

      const { rule, match, grammar: ruleGrammar } = candidate;
      if (rule.match) {
        if (rule.name) addRange(node, ...match.indices[0], rule.name);
        addCaptures(node, match, rule.captures);
        cursor = match.indices[0][1] > cursor ? match.indices[0][1] : cursor + 1;
        continue;
      }

      const nested = scanRegion(
        node,
        rule.patterns || [],
        match.indices[0][1],
        end,
        ruleGrammar,
        baseGrammar,
        { pattern: expandEnd(rule.end, match), applyEndPatternLast: rule.applyEndPatternLast }
      );

      if (rule.name) addRange(node, match.indices[0][0], nested.end, rule.name);
      if (rule.contentName) addRange(node, match.indices[0][1], nested.contentEnd, rule.contentName);
      addCaptures(node, match, rule.beginCaptures || rule.captures);
      if (nested.match) addCaptures(node, nested.match, rule.endCaptures || rule.captures);

      cursor = nested.end > cursor ? nested.end : cursor + 1;
    }

    return { contentEnd: end, end, match: null };
  };

  blocks.forEach(code => {
    const grammar = grammarFor(code);
    const node = code.firstChild;
    if (!grammar || code.childNodes.length !== 1 || node.nodeType !== Node.TEXT_NODE) return;

    scanRegion(node, grammar.patterns, 0, node.data.length, grammar);
  });

  highlights.forEach((ranges, category) => {
    if (ranges.size) CSS.highlights.set(category, ranges);
  });
};
