// Minimal AsciiMath parser to satisfy acceptance criteria for inputs like "(a+b)^2" and "sin(x)^2".
// It returns both Content MathML and Presentation MathML as strings, or a structured error.

export type ParseSuccess = {
  ok: true;
  contentMathML: string;
  presentationMathML: string;
};

export type ParseError = {
  ok: false;
  error: {
    message: string;
    index: number; // error position in input
    near?: string;
  };
};

export type ParseResult = ParseSuccess | ParseError;

// Tokenizer for a tiny subset: identifiers (letters), numbers, ^, (, ), '+', '-', '*', '/', relational (=, <, >, <=, >=), and function names like sin, cos
function tokenize(input: string) {
  const tokens: { type: string; value: string; index: number }[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    if (c === '^' || c === '(' || c === ')' || c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ type: c, value: c, index: i });
      i++;
      continue;
    }
    // relational operators: <=, >=, =, <, >
    if (c === '<' || c === '>' || c === '=') {
      if ((c === '<' || c === '>') && i + 1 < input.length && input[i + 1] === '=') {
        const two = c + '=';
        tokens.push({ type: two, value: two, index: i });
        i += 2;
        continue;
      }
      tokens.push({ type: c, value: c, index: i });
      i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < input.length && /[0-9]/.test(input[j])) j++;
      tokens.push({ type: 'NUMBER', value: input.slice(i, j), index: i });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i + 1;
      while (j < input.length && /[a-zA-Z]/.test(input[j])) j++;
      const word = input.slice(i, j);
      tokens.push({ type: 'IDENT', value: word, index: i });
      i = j;
      continue;
    }
    // Unknown character
    tokens.push({ type: 'UNKNOWN', value: c, index: i });
    i++;
  }
  return tokens;
}

// Simple recursive-descent parser for a tiny subset:
// Expr := Rel
// Rel := Add ( ('=' | '<' | '>' | '<=' | '>=') Add )?
// Add := Mul ( ('+' | '-') Mul )*
// Mul := Power ( '*' Power )*
// Power := Primary ('^' Power)?  (right-associative)
// Primary := Function | IDENT | NUMBER | '(' Expr ')'
// Function := IDENT '(' Expr ')'
// Implemented functions: sin (extendable later)

type AST =
  | { kind: 'ident'; name: string; id?: string }
  | { kind: 'number'; value: string; id?: string }
  | { kind: 'power'; base: AST; exponent: AST; id?: string }
  | { kind: 'add'; terms: AST[]; id?: string }
  | { kind: 'mul'; factors: AST[]; id?: string }
  | { kind: 'call'; func: string; arg: AST; id?: string }
  | { kind: 'rel'; op: 'eq' | 'lt' | 'le' | 'gt' | 'ge'; left: AST; right: AST; id?: string }
  | { kind: 'diff'; var: AST; arg: AST; id?: string };

function parse(input: string): { ast?: AST; error?: ParseError['error'] } {
  const tokens = tokenize(input);
  let pos = 0;

  function peek() {
    return tokens[pos];
  }
  function consume(type?: string) {
    const t = tokens[pos];
    if (!t) return undefined as any;
    if (type && t.type !== type) return undefined as any;
    pos++;
    return t;
  }

  function parseExpr(): AST | undefined {
    return parseRel();
  }

  function parseRel(): AST | undefined {
    const left = parseAdd();
    if (!left) return undefined;
    const t = peek();
    if (t && (t.type === '=' || t.type === '<' || t.type === '>' || t.type === '<=' || t.type === '>=')) {
      const opTok = consume()!;
      const right = parseAdd();
      if (!right) return undefined;
      const map: Record<string, 'eq'|'lt'|'le'|'gt'|'ge'> = { '=': 'eq', '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge' };
      const op = map[opTok.type];
      return { kind: 'rel', op, left, right };
    }
    return left;
  }

  function parseAdd(): AST | undefined {
    let left = parseMul();
    if (!left) return undefined;
    const terms: AST[] = [left];
    while (peek() && (peek().type === '+' || peek().type === '-')) {
      const op = consume()!.type;
      const rhs = parseMul();
      if (!rhs) return undefined;
      if (op === '+') {
        terms.push(rhs);
      } else {
        // represent subtraction as addition of (-1)*rhs
        terms.push({ kind: 'mul', factors: [{ kind: 'number', value: '-1' }, rhs] });
      }
    }
    if (terms.length === 1) return left;
    return { kind: 'add', terms };
  }

  function parseMul(): AST | undefined {
    let left = parsePower();
    if (!left) return undefined;
    const factors: AST[] = [left];
    while (true) {
      const t = peek();
      if (!t) break;
      if (t.type === '*') {
        consume('*');
        const rhs = parsePower();
        if (!rhs) return undefined;
        factors.push(rhs);
        continue;
      }
      // Implicit multiplication: adjacency of primaries like 2x, x(y), )x, )(
      if (t.type === 'IDENT' || t.type === 'NUMBER' || t.type === '(') {
        const rhs = parsePower();
        if (!rhs) return undefined;
        factors.push(rhs);
        continue;
      }
      break;
    }
    if (factors.length === 1) return left;
    return { kind: 'mul', factors };
  }

  function parsePower(): AST | undefined {
    let base = parsePrimary();
    if (!base) return undefined;
    if (peek() && peek().type === '^') {
      consume('^');
      const exponent = parsePower(); // right associative
      if (!exponent) return undefined;
      return { kind: 'power', base, exponent };
    }
    return base;
  }

  function parsePrimary(): AST | undefined {
    const t = peek();
    if (!t) return undefined;

    // Derivative pattern: d/dx <expr> or d/dx(<expr>)
    if (t.type === 'IDENT' && t.value.toLowerCase() === 'd') {
      const t1 = tokens[pos + 1];
      const t2 = tokens[pos + 2];
      if (t1 && t1.type === '/' && t2 && t2.type === 'IDENT') {
        const word = t2.value;
        if (word.length >= 2 && word[0].toLowerCase() === 'd') {
          const varName = word.slice(1); // e.g., 'dx' -> 'x'
          if (varName && /^[a-zA-Z]+$/.test(varName)) {
            // consume 'd' '/' 'd<var>'
            consume('IDENT');
            consume('/');
            consume('IDENT');
            // parse argument: either parenthesized Expr or a Power (to include x^2)
            let arg: AST | undefined;
            if (peek() && peek().type === '(') {
              consume('(');
              arg = parseExpr();
              if (!arg) return undefined;
              if (!consume(')')) return undefined;
            } else {
              arg = parsePower();
              if (!arg) return undefined;
            }
            return { kind: 'diff', var: { kind: 'ident', name: varName }, arg };
          }
        }
      }
    }

    if (t.type === 'IDENT') {
      // function call or variable
      // lookahead for '('
      if (tokens[pos + 1] && tokens[pos + 1].type === '(') {
        const funcTok = consume('IDENT');
        consume('(');
        const arg = parseExpr();
        if (!arg) return undefined;
        if (!consume(')')) {
          return undefined;
        }
        return { kind: 'call', func: funcTok!.value, arg };
      }
      consume('IDENT');
      return { kind: 'ident', name: t.value };
    }
    if (t.type === 'NUMBER') {
      consume('NUMBER');
      return { kind: 'number', value: t.value };
    }
    if (t.type === '(') {
      consume('(');
      const e = parseExpr();
      if (!e) return undefined;
      if (!consume(')')) return undefined;
      return e;
    }
    return undefined;
  }

  const ast = parseExpr();
  const extra = peek();
  if (!ast) {
    const idx = extra ? extra.index : input.length;
    return { error: { message: 'Parse error', index: idx, near: input.slice(idx, idx + 5) } };
  }
  if (pos !== tokens.length) {
    const idx = extra ? extra.index : input.length;
    return { error: { message: 'Unexpected input', index: idx, near: input.slice(idx, idx + 5) } };
  }
  return { ast };
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Deterministic hashing (djb2) to generate stable node IDs from canonical content
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash | 0; // force 32-bit
  }
  // Convert to unsigned hex
  return (hash >>> 0).toString(16);
}

// Canonical serialization of AST suitable for stable hashing
function canonical(ast: AST): string {
  switch (ast.kind) {
    case 'ident':
      return `ident:${ast.name}`;
    case 'number':
      return `number:${ast.value}`;
    case 'power':
      return `power(${canonical(ast.base)},${canonical(ast.exponent)})`;
    case 'add':
      return `add(${ast.terms.map(canonical).join(',')})`;
    case 'mul':
      return `mul(${ast.factors.map(canonical).join(',')})`;
    case 'call':
      return `call:${ast.func}(${canonical(ast.arg)})`;
    case 'rel':
      return `rel:${ast.op}(${canonical(ast.left)},${canonical(ast.right)})`;
    case 'diff':
      return `diff(${canonical(ast.var)},${canonical(ast.arg)})`;
  }
}

function withStableIds(ast: AST): AST {
  switch (ast.kind) {
    case 'ident': {
      const id = hashString(canonical(ast));
      return { ...ast, id };
    }
    case 'number': {
      const id = hashString(canonical(ast));
      return { ...ast, id };
    }
    case 'power': {
      const base = withStableIds(ast.base);
      const exponent = withStableIds(ast.exponent);
      const id = hashString(`power(${canonical(base)},${canonical(exponent)})`);
      return { ...ast, base, exponent, id };
    }
    case 'add': {
      const terms = ast.terms.map(withStableIds);
      const id = hashString(`add(${terms.map(canonical).join(',')})`);
      return { ...ast, terms, id };
    }
    case 'mul': {
      const factors = ast.factors.map(withStableIds);
      const id = hashString(`mul(${factors.map(canonical).join(',')})`);
      return { ...ast, factors, id };
    }
    case 'call': {
      const arg = withStableIds(ast.arg);
      const id = hashString(`call:${ast.func}(${canonical(arg)})`);
      return { ...ast, arg, id };
    }
    case 'rel': {
      const left = withStableIds(ast.left);
      const right = withStableIds(ast.right);
      const id = hashString(`rel:${ast.op}(${canonical(left)},${canonical(right)})`);
      return { ...ast, left, right, id };
    }
    case 'diff': {
      const v = withStableIds(ast.var);
      const arg = withStableIds(ast.arg);
      const id = hashString(`diff(${canonical(v)},${canonical(arg)})`);
      return { ...ast, var: v, arg, id };
    }
  }
}

// Convert AST to Content MathML (no data-node-id needed for now)
function toContentMathML(ast: AST): string {
  switch (ast.kind) {
    case 'ident':
      return `<ci>${escapeXml(ast.name)}</ci>`;
    case 'number':
      return `<cn>${escapeXml(ast.value)}</cn>`;
    case 'power':
      return `<apply><power/>${toContentMathML(ast.base)}${toContentMathML(ast.exponent)}</apply>`;
    case 'add':
      return `<apply><plus/>${ast.terms.map(toContentMathML).join('')}</apply>`;
    case 'mul':
      return `<apply><times/>${ast.factors.map(toContentMathML).join('')}</apply>`;
    case 'call': {
      const func = ast.func.toLowerCase();
      if (func === 'sin') {
        return `<apply><sin/>${toContentMathML(ast.arg)}</apply>`;
      }
      // Fallback: treat as generic identifier function symbol
      return `<apply><ci>${escapeXml(ast.func)}</ci>${toContentMathML(ast.arg)}</apply>`;
    }
    case 'rel': {
      const tag = ast.op === 'eq' ? 'eq' : ast.op === 'lt' ? 'lt' : ast.op === 'le' ? 'leq' : ast.op === 'gt' ? 'gt' : 'geq';
      return `<apply><${tag}/> ${toContentMathML(ast.left)}${toContentMathML(ast.right)}</apply>`;
    }
    case 'diff': {
      // Emit variable first for stability: <apply><diff/><ci>var</ci><expr/></apply>
      const v = ast.var.kind === 'ident' ? `<ci>${escapeXml((ast.var as any).name)}</ci>` : toContentMathML(ast.var);
      const a = toContentMathML(ast.arg);
      return `<apply><diff/>${v}${a}</apply>`;
    }
  }
}

// Convert AST to Presentation MathML with data-node-id annotations
function toPresentationMathML(ast: AST): string {
  function pres(n: AST): string {
    switch (n.kind) {
      case 'ident':
        return `<mi data-node-id="${n.id}">${escapeXml(n.name)}</mi>`;
      case 'number':
        return `<mn data-node-id="${n.id}">${escapeXml(n.value)}</mn>`;
      case 'power': {
        const needsParens = (b: AST) => b.kind === 'add' || b.kind === 'rel' || (b.kind === 'mul' && (b as any).factors && (b as any).factors.length > 1);
        const baseInner = pres(n.base);
        const baseWrapped = needsParens(n.base) ? `<mrow><mo>(</mo>${baseInner}<mo>)</mo></mrow>` : `<mrow>${baseInner}</mrow>`;
        return `<msup data-node-id="${n.id}">${baseWrapped}${pres(n.exponent)}</msup>`;
      }
      case 'add': {
        const id = n.id || '';
        function isNegNumber(x: AST): boolean { return x.kind === 'number' && /^-/.test(x.value); }
        function isNegOneMul(x: AST): { neg: boolean; rest?: AST[] } {
          if (x.kind !== 'mul' || x.factors.length === 0) return { neg: false } as any;
          const f0 = x.factors[0];
          if (f0.kind === 'number' && /^-?1$/.test(f0.value)) {
            if (f0.value.trim() === '-1') {
              const rest = x.factors.slice(1);
              return { neg: true, rest: rest.length ? rest : [{ kind: 'number', value: '1' } as any] } as any;
            }
          }
          return { neg: false } as any;
        }
        const parts: string[] = [];
        n.terms.forEach((t, i) => {
          const negNum = isNegNumber(t);
          const negMul = isNegOneMul(t);
          if (i === 0) {
            if (negNum) {
              const abs = { ...t, value: (t as any).value.replace(/^-+/, '') } as AST;
              parts.push('<mo data-node-id="' + id + '">-</mo>' + pres(abs));
            } else if (negMul.neg) {
              const inner = (negMul.rest as AST[]).map(pres).join('<mo>·</mo>');
              parts.push('<mo data-node-id="' + id + '">-</mo>' + `<mrow>${inner}</mrow>`);
            } else {
              parts.push(pres(t));
            }
          } else {
            if (negNum) {
              const abs = { ...t, value: (t as any).value.replace(/^-+/, '') } as AST;
              parts.push(`<mo data-node-id="${id}">-</mo>` + pres(abs));
            } else if (negMul.neg) {
              const inner = (negMul.rest as AST[]).map(pres).join('<mo>·</mo>');
              parts.push(`<mo data-node-id="${id}">-</mo>` + `<mrow>${inner}</mrow>`);
            } else {
              parts.push(`<mo data-node-id="${id}">+</mo>` + pres(t));
            }
          }
        });
        return `<mrow data-node-id="${id}">${parts.join('')}</mrow>`;
      }
      case 'mul': {
        const id = n.id || '';
        const inner = n.factors.map(pres).join('<mo data-node-id="' + id + '">·</mo>');
        return `<mrow data-node-id="${id}">${inner}</mrow>`;
      }
      case 'call': {
        const id = n.id || '';
        const fname = `<mi>${escapeXml(n.func)}</mi>`;
        return `<mrow data-node-id="${id}">${fname}<mo>(</mo>${pres(n.arg)}<mo>)</mo></mrow>`;
      }
      case 'rel': {
        const id = n.id || '';
        const sym = n.op === 'eq' ? '=' : n.op === 'lt' ? '&lt;' : n.op === 'le' ? '≤' : n.op === 'gt' ? '&gt;' : '≥';
        return `<mrow data-node-id="${id}">${pres(n.left)}<mo>${sym}</mo>${pres(n.right)}</mrow>`;
      }
      case 'diff': {
        const id = n.id || '';
        // Presentation form: (d)/(dx) ( arg ) for clarity
        const v = n.var.kind === 'ident' ? (n.var as any).name : 'x';
        return `<mrow data-node-id="${id}"><mfrac><mi>d</mi><mrow><mi>d</mi><mi>${escapeXml(v)}</mi></mrow></mfrac><mo>\u00A0</mo><mo>(</mo>${pres(n.arg)}<mo>)</mo></mrow>`;
      }
    }
  }
  return pres(ast);
}

export function parseAsciiMath(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: { message: 'Empty input', index: 0 } };
  }

  const res = parse(trimmed);
  if (res.error) {
    return { ok: false, error: res.error };
  }
  const rawAst = res.ast!;
  const ast = withStableIds(rawAst);
  const contentCore = toContentMathML(ast);
  const presentationCore = toPresentationMathML(ast);
  const contentMathML = `<math xmlns="http://www.w3.org/1998/Math/MathML">${contentCore}</math>`;
  const presentationMathML = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${presentationCore}</math>`;
  return { ok: true, contentMathML, presentationMathML };
}
