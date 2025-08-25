// Minimal Content MathML AST utilities for find/replace by node id.
// Supports subset: <ci>, <cn>, <apply><power/>, <apply><plus/>, <apply><times/>, <apply><sin/>, <apply><cos/>, and generic <apply><ci>f</ci> arg</apply>

export type ASTNode =
  | { kind: 'ident'; name: string; id?: string }
  | { kind: 'number'; value: string; id?: string }
  | { kind: 'power'; base: ASTNode; exponent: ASTNode; id?: string }
  | { kind: 'add'; terms: ASTNode[]; id?: string }
  | { kind: 'mul'; factors: ASTNode[]; id?: string }
  | { kind: 'call'; func: string; arg: ASTNode; id?: string }
  | { kind: 'rel'; op: 'eq' | 'lt' | 'le' | 'gt' | 'ge'; left: ASTNode; right: ASTNode; id?: string }
  | { kind: 'diff'; var: ASTNode; arg: ASTNode; id?: string };

// djb2 hash to hex, matching server/client logic
function djb2Hex(s: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) >>> 0) + s.charCodeAt(i);
    h = h >>> 0;
  }
  return (h >>> 0).toString(16);
}

function canonical(ast: ASTNode): string {
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

export function withIds(ast: ASTNode): ASTNode {
  switch (ast.kind) {
    case 'ident': {
      const id = djb2Hex(canonical(ast));
      return { ...ast, id };
    }
    case 'number': {
      const id = djb2Hex(canonical(ast));
      return { ...ast, id };
    }
    case 'power': {
      const base = withIds(ast.base);
      const exponent = withIds(ast.exponent);
      const id = djb2Hex(canonical({ ...ast, base, exponent }));
      return { ...ast, base, exponent, id };
    }
    case 'add': {
      const terms = ast.terms.map(withIds);
      const id = djb2Hex(canonical({ ...ast, terms }));
      return { ...ast, terms, id };
    }
    case 'mul': {
      const factors = ast.factors.map(withIds);
      const id = djb2Hex(canonical({ ...ast, factors }));
      return { ...ast, factors, id };
    }
    case 'call': {
      const arg = withIds(ast.arg);
      const id = djb2Hex(canonical({ ...ast, arg }));
      return { ...ast, arg, id };
    }
    case 'rel': {
      const left = withIds(ast.left);
      const right = withIds(ast.right);
      const id = djb2Hex(canonical({ ...ast, left, right }));
      return { ...ast, left, right, id };
    }
    case 'diff': {
      const v = withIds(ast.var);
      const a = withIds(ast.arg);
      const id = djb2Hex(canonical({ ...ast, var: v, arg: a } as any));
      return { ...(ast as any), var: v, arg: a, id } as any;
    }
  }
}

// Parse Content MathML string into ASTNode (subset)
export function parseContentMathMLToAst(content: string): ASTNode {
  // Use DOMParser to parse XML-ish string; MathML can be parsed in text/html reliably enough for our subset
  const parser = new DOMParser();
  // Try as application/xml first for stricter handling; fall back to text/html
  let doc = parser.parseFromString(content, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) {
    doc = parser.parseFromString(content, 'text/html');
  }
  let root: Element | null = doc.querySelector('math');
  let node: Element | null = root && root.firstElementChild ? root.firstElementChild as Element : null;
  if (!root) {
    // maybe content is core without <math>
    const wrapper = parser.parseFromString(`<math xmlns="http://www.w3.org/1998/Math/MathML">${content}</math>`, 'text/html');
    root = wrapper.querySelector('math');
    node = root && root.firstElementChild ? root.firstElementChild as Element : null;
  }
  if (!node && root) node = root as Element;
  if (!node) throw new Error('Invalid MathML content');

  function toAst(n: Element): ASTNode {
    const tag = n.tagName.toLowerCase();
    if (tag.endsWith('ci')) {
      const name = (n.textContent || '').trim() || 'x';
      return { kind: 'ident', name };
    }
    if (tag.endsWith('cn')) {
      const value = (n.textContent || '0').trim();
      return { kind: 'number', value };
    }
    // Tolerate <mtext> in content by treating it as an identifier (or number if numeric)
    if (tag.endsWith('mtext')) {
      const txt = (n.textContent || '').trim();
      if (/^[0-9]+$/.test(txt)) {
        return { kind: 'number', value: txt };
      }
      const name = txt || 'x';
      return { kind: 'ident', name };
    }
    if (tag.endsWith('apply')) {
      if (!n.firstElementChild) throw new Error('empty apply');
      const head = n.firstElementChild as Element;
      const args: ASTNode[] = [];
      let child = head.nextElementSibling as Element | null;
      while (child) {
        args.push(toAst(child));
        child = child.nextElementSibling as Element | null;
      }
      const htag = head.tagName.toLowerCase();
      if (htag.endsWith('power') && args.length === 2) return { kind: 'power', base: args[0], exponent: args[1] };
      if (htag.endsWith('plus')) return { kind: 'add', terms: args };
      if (htag.endsWith('times')) return { kind: 'mul', factors: args };
      if (htag.endsWith('sin') && args.length === 1) return { kind: 'call', func: 'sin', arg: args[0] };
      if (htag.endsWith('cos') && args.length === 1) return { kind: 'call', func: 'cos', arg: args[0] };
      if (htag.endsWith('diff')) {
        if (args.length === 2) {
          const a0 = args[0];
          const a1 = args[1];
          if (a0.kind === 'ident') return { kind: 'diff', var: a0, arg: a1 } as any;
          if (a1.kind === 'ident') return { kind: 'diff', var: a1, arg: a0 } as any;
        }
        throw new Error('Unsupported operator: diff form');
      }
      if ((htag.endsWith('eq') || htag.endsWith('lt') || htag.endsWith('leq') || htag.endsWith('gt') || htag.endsWith('geq')) && args.length === 2) {
        const map: Record<string, 'eq'|'lt'|'le'|'gt'|'ge'> = { eq: 'eq', lt: 'lt', leq: 'le', gt: 'gt', geq: 'ge' };
        const key = htag.split(':').pop()!; // handle ns
        const op = map[key as keyof typeof map];
        if (op) return { kind: 'rel', op, left: args[0], right: args[1] };
      }
      if (htag.endsWith('ci') && args.length >= 1) return { kind: 'call', func: (head.textContent || 'f').trim(), arg: args[0] };
      throw new Error(`Unsupported operator: ${htag}`);
    }
    // Try descent if single child
    if (n.children && n.children.length === 1) {
      return toAst(n.children[0] as Element);
    }
    throw new Error(`Unsupported tag: ${tag}`);
  }

  return toAst(node);
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function astToContentMathML(ast: ASTNode): string {
  function core(n: ASTNode): string {
    switch (n.kind) {
      case 'ident':
        return `<ci>${escapeXml(n.name)}</ci>`;
      case 'number':
        return `<cn>${escapeXml(n.value)}</cn>`;
      case 'power':
        return `<apply><power/>${core(n.base)}${core(n.exponent)}</apply>`;
      case 'add':
        return `<apply><plus/>${n.terms.map(core).join('')}</apply>`;
      case 'mul':
        return `<apply><times/>${n.factors.map(core).join('')}</apply>`;
      case 'call': {
        const f = n.func.toLowerCase();
        if (f === 'sin') return `<apply><sin/>${core(n.arg)}</apply>`;
        if (f === 'cos') return `<apply><cos/>${core(n.arg)}</apply>`;
        return `<apply><ci>${escapeXml(n.func)}</ci>${core(n.arg)}</apply>`;
      }
      case 'rel': {
        const tag = n.op === 'eq' ? 'eq' : n.op === 'lt' ? 'lt' : n.op === 'le' ? 'leq' : n.op === 'gt' ? 'gt' : 'geq';
        return `<apply><${tag}/> ${core(n.left)}${core(n.right)}</apply>`;
      }
      case 'diff': {
        const v = n.var.kind === 'ident' ? `<ci>${escapeXml((n.var as any).name)}</ci>` : core(n.var);
        const a = core(n.arg);
        return `<apply><diff/>${v}${a}</apply>`;
      }
    }
  }
  const inner = core(ast);
  return `<math xmlns="http://www.w3.org/1998/Math/MathML">${inner}</math>`;
}

// Serialize AST to Presentation MathML with data-node-id attributes preserved on AST nodes
export function astToPresentationMathML(ast: ASTNode): string {
  function pres(n: ASTNode): string {
    switch (n.kind) {
      case 'ident':
        return `<mi data-node-id="${(n as any).id || ''}">${escapeXml(n.name)}</mi>`;
      case 'number':
        return `<mn data-node-id="${(n as any).id || ''}">${escapeXml(n.value)}</mn>`;
      case 'power': {
        const needsParens = (b: ASTNode) => b.kind === 'add' || b.kind === 'rel' || (b.kind === 'mul' && (b as any).factors && (b as any).factors.length > 1);
        const baseInner = pres(n.base);
        const baseWrapped = needsParens(n.base) ? `<mrow><mo>(</mo>${baseInner}<mo>)</mo></mrow>` : `<mrow>${baseInner}</mrow>`;
        const exp = pres(n.exponent);
        return `<msup data-node-id="${(n as any).id || ''}">${baseWrapped}${exp}</msup>`;
      }
      case 'add': {
        const id = (n as any).id || '';
        function isNegNumber(x: ASTNode): boolean {
          return x.kind === 'number' && /^-/.test(x.value);
        }
        function isNegOneMul(x: ASTNode): { neg: boolean; rest?: ASTNode[] } {
          if (x.kind !== 'mul' || x.factors.length === 0) return { neg: false };
          const f0 = x.factors[0];
          if (f0.kind === 'number' && /^-?1$/.test(f0.value)) {
            if (f0.value.trim() === '-1') {
              const rest = x.factors.slice(1);
              return { neg: true, rest: rest.length ? rest : [{ kind: 'number', value: '1' }] } as any;
            }
          }
          return { neg: false };
        }
        const parts: string[] = [];
        n.terms.forEach((t, i) => {
          // detect negative term formats
          const negNum = isNegNumber(t);
          const negMul = isNegOneMul(t);
          if (i === 0) {
            if (negNum) {
              const abs = { ...t, value: (t as any).value.replace(/^-+/, '') } as ASTNode;
              parts.push('<mo data-node-id="' + id + '">-</mo>' + pres(abs));
            } else if (negMul.neg) {
              // render leading '-' then product without the -1 factor
              const inner = (negMul.rest as ASTNode[]).map(pres).join('<mo>·</mo>');
              parts.push('<mo data-node-id="' + id + '">-</mo>' + `<mrow>${inner}</mrow>`);
            } else {
              parts.push(pres(t));
            }
          } else {
            if (negNum) {
              const abs = { ...t, value: (t as any).value.replace(/^-+/, '') } as ASTNode;
              parts.push(`<mo data-node-id="${id}">-</mo>` + pres(abs));
            } else if (negMul.neg) {
              const inner = (negMul.rest as ASTNode[]).map(pres).join('<mo>·</mo>');
              parts.push(`<mo data-node-id="${id}">-</mo>` + `<mrow>${inner}</mrow>`);
            } else {
              parts.push(`<mo data-node-id="${id}">+</mo>` + pres(t));
            }
          }
        });
        return `<mrow data-node-id="${id}">${parts.join('')}</mrow>`;
      }
      case 'mul': {
        const id = (n as any).id || '';
        const inner = n.factors.map(pres).join('<mo data-node-id="' + id + '">·</mo>');
        return `<mrow data-node-id="${id}">${inner}</mrow>`;
      }
      case 'call': {
        const id = (n as any).id || '';
        const fname = `<mi>${escapeXml(n.func)}</mi>`;
        return `<mrow data-node-id="${id}">${fname}<mo>(</mo>${pres(n.arg)}<mo>)</mo></mrow>`;
      }
      case 'rel': {
        const id = (n as any).id || '';
        const sym = n.op === 'eq' ? '=' : n.op === 'lt' ? '&lt;' : n.op === 'le' ? '≤' : n.op === 'gt' ? '&gt;' : '≥';
        return `<mrow data-node-id="${id}">${pres(n.left)}<mo>${sym}</mo>${pres(n.right)}</mrow>`;
      }
      case 'diff': {
        const id = (n as any).id || '';
        const v = n.var.kind === 'ident' ? (n.var as any).name : 'x';
        return `<mrow data-node-id="${id}"><mfrac><mi>d</mi><mrow><mi>d</mi><mi>${escapeXml(v)}</mi></mrow></mfrac><mo>\u00A0</mo><mo>(</mo>${pres(n.arg)}<mo>)</mo></mrow>`;
      }
    }
  }
  const inner = pres(ast);
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${inner}</math>`;
}

export function findAndReplaceById(ast: ASTNode, nodeId: string, replacement: ASTNode): ASTNode {
  const targetId = nodeId;
  function walk(n: ASTNode): ASTNode {
    if ((n as any).id && (n as any).id === targetId) {
      return replacement;
    }
    switch (n.kind) {
      case 'ident':
      case 'number':
        return n;
      case 'power':
        return { ...n, base: walk(n.base), exponent: walk(n.exponent) };
      case 'add':
        return { ...n, terms: n.terms.map(walk) };
      case 'mul':
        return { ...n, factors: n.factors.map(walk) };
      case 'call':
        return { ...n, arg: walk(n.arg) };
      case 'rel':
        return { ...n, left: walk(n.left), right: walk(n.right) } as any;
      case 'diff':
        return { ...n, var: walk(n.var), arg: walk(n.arg) } as any;
    }
  }
  return walk(ast);
}

export function findNodeById(ast: ASTNode, nodeId: string): ASTNode | null {
  if ((ast as any).id === nodeId) return ast;
  switch (ast.kind) {
    case 'ident':
    case 'number':
      return null;
    case 'power': {
      return findNodeById(ast.base, nodeId) || findNodeById(ast.exponent, nodeId);
    }
    case 'add': {
      for (const t of ast.terms) {
        const found = findNodeById(t, nodeId);
        if (found) return found;
      }
      return null;
    }
    case 'mul': {
      for (const f of ast.factors) {
        const found = findNodeById(f, nodeId);
        if (found) return found;
      }
      return null;
    }
    case 'call':
      return findNodeById(ast.arg, nodeId);
    case 'rel': {
      return findNodeById(ast.left, nodeId) || findNodeById(ast.right, nodeId);
    }
    case 'diff': {
      return findNodeById(ast.var, nodeId) || findNodeById(ast.arg, nodeId);
    }
  }
}

export function astToAsciiMath(ast: ASTNode): string {
  function isAtom(n: ASTNode): boolean {
    return n.kind === 'ident' || n.kind === 'number';
  }
  function needsParensInPowBase(n: ASTNode): boolean {
    return n.kind === 'add' || n.kind === 'mul';
  }
  function needsParensForArg(n: ASTNode): boolean {
    return n.kind === 'add' || n.kind === 'power' || n.kind === 'call' || n.kind === 'mul';
  }
  function stripLeadingMinusOneFromMul(n: ASTNode): { neg: boolean; rest: ASTNode[] } {
    if (n.kind !== 'mul' || n.factors.length === 0) return { neg: false, rest: [] } as any;
    const f0 = n.factors[0];
    if (f0.kind === 'number' && /^-?1$/.test(f0.value)) {
      if (f0.value.trim() === '-1') {
        const rest = n.factors.slice(1);
        return { neg: true, rest: rest.length ? rest : [{ kind: 'number', value: '1' } as any] } as any;
      }
    }
    return { neg: false, rest: [] } as any;
  }
  function toAM(n: ASTNode): string {
    switch (n.kind) {
      case 'ident':
        return n.name;
      case 'number':
        return n.value;
      case 'add': {
        const parts: string[] = [];
        n.terms.forEach((t, i) => {
          if (t.kind === 'number' && /^-/.test(t.value)) {
            const abs = (t.value as string).replace(/^-+/, '');
            parts.push((i === 0 ? '-' : ' - ') + abs);
          } else if (t.kind === 'mul') {
            const info = stripLeadingMinusOneFromMul(t);
            if (info.neg) {
              const inner = info.rest.map(toAM).join('*');
              parts.push((i === 0 ? '-' : ' - ') + (info.rest.length === 1 ? inner : inner));
            } else {
              parts.push((i === 0 ? '' : ' + ') + toAM(t));
            }
          } else {
            parts.push((i === 0 ? '' : ' + ') + toAM(t));
          }
        });
        return parts.join('');
      }
      case 'mul': {
        // Don't show explicit * for function application like sin(x)
        const inner = n.factors.map(toAM).join('*');
        return inner;
      }
      case 'power': {
        const base = needsParensInPowBase(n.base) ? `(${toAM(n.base)})` : toAM(n.base);
        const exp = isAtom(n.exponent) ? toAM(n.exponent) : `(${toAM(n.exponent)})`;
        return `${base}^${exp}`;
      }
      case 'call': {
        const f = n.func.toLowerCase();
        const arg = needsParensForArg(n.arg) ? `(${toAM(n.arg)})` : toAM(n.arg);
        return `${f}(${arg})`;
      }
      case 'rel': {
        const sym = n.op === 'eq' ? '=' : n.op === 'lt' ? '<' : n.op === 'le' ? '<=' : n.op === 'gt' ? '>' : '>=';
        return `${toAM(n.left)} ${sym} ${toAM(n.right)}`;
      }
      case 'diff': {
        const v = n.var.kind === 'ident' ? (n.var as any).name : toAM(n.var);
        const argStr = `(${toAM(n.arg)})`;
        return `d/d${v} ${argStr}`;
      }
    }
  }
  return toAM(ast);
}

export type OperationType =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'exponentiate'
  | 'functionApply'
  | 'rewriteIdentity'
  | 'substitute';

export type Operation = {
  operationType: OperationType;
  // For add/subtract/multiply/divide/exponentiate, we use an operand node
  operand?: ASTNode;
  // For functionApply, name of function
  funcName?: string;
};

// --- Operation application with optional mirroring across relations ---
function clone(n: ASTNode): ASTNode { return JSON.parse(JSON.stringify(n)); }

function isNumber(n: ASTNode): n is Extract<ASTNode, { kind: 'number' }> { return n.kind === 'number'; }

function addNodes(a: ASTNode, b: ASTNode): ASTNode {
  // Flatten additions and combine numeric literals
  const terms: ASTNode[] = [];
  function pushTerm(t: ASTNode) {
    if (t.kind === 'add') {
      t.terms.forEach(pushTerm);
    } else {
      terms.push(t);
    }
  }
  pushTerm(a);
  pushTerm(b);
  // Combine numeric terms
  let sum = 0;
  const others: ASTNode[] = [];
  for (const t of terms) {
    if (isNumber(t) && /^-?\d+(?:\.\d+)?$/.test(t.value)) {
      sum += parseFloat(t.value);
    } else {
      others.push(t);
    }
  }
  const resultTerms = [...others];
  if (!Number.isNaN(sum) && sum !== 0) {
    resultTerms.push({ kind: 'number', value: String(sum) });
  }
  if (resultTerms.length === 0) return { kind: 'number', value: '0' };
  if (resultTerms.length === 1) return resultTerms[0];
  return { kind: 'add', terms: resultTerms };
}

function applySingleOperation(node: ASTNode, op: Operation): ASTNode {
  switch (op.operationType) {
    case 'add': {
      const operand = op.operand ?? { kind: 'number', value: '0' };
      return addNodes(node, clone(operand));
    }
    case 'subtract': {
      const operand = op.operand ?? { kind: 'number', value: '0' };
      // represent subtraction as addition of (-1)*operand simple: if number, negate; else keep as add with (-1)*operand
      if (isNumber(operand) && /^-?\d+(?:\.\d+)?$/.test(operand.value)) {
        const neg = { kind: 'number', value: String(-parseFloat(operand.value)) } as ASTNode;
        return addNodes(node, neg);
      }
      return addNodes(node, { kind: 'mul', factors: [ { kind: 'number', value: '-1' }, clone(operand) ] });
    }
    default:
      return { ...node };
  }
}

export function applyOperationWithMirror(ast: ASTNode, operation: Operation, options?: { mirror?: boolean }): ASTNode {
  const mirror = !!(options && options.mirror);
  // Identities do not mirror
  if (operation.operationType === 'rewriteIdentity') {
    return applySingleOperation(ast, operation);
  }
  if (mirror && ast.kind === 'rel') {
    // Apply to both sides for reversible ops (we minimally support add/subtract here)
    const left = applySingleOperation(ast.left, operation);
    const right = applySingleOperation(ast.right, operation);
    return withIds({ kind: 'rel', op: ast.op, left, right });
  }
  return withIds(applySingleOperation(ast, operation));
}
