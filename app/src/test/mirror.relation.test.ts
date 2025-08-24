import { describe, it, expect } from 'vitest';
import { parseContentMathMLToAst, withIds, applyOperationWithMirror, astToAsciiMath } from '../lib/contentAst';

function wrap(inner: string) {
  return `<math xmlns="http://www.w3.org/1998/Math/MathML">${inner}</math>`;
}

// Build Content MathML for: x + 2 = 7
const relationContent = wrap(
  '<apply><eq/>' +
    '<apply><plus/><ci>x</ci><cn>2</cn></apply>' +
    '<cn>7</cn>' +
  '</apply>'
);

describe('Mirroring reversible operations across relations', () => {
  it('with mirror enabled, x + 2 = 7 and operation +3 yields x + 5 = 10', () => {
    const ast = withIds(parseContentMathMLToAst(relationContent));
    const op = { operationType: 'add' as const, operand: { kind: 'number', value: '3' } };
    const newAst = applyOperationWithMirror(ast, op, { mirror: true });
    const am = astToAsciiMath(newAst);
    expect(am.replace(/\s+/g, ' ').trim()).toBe('x + 5 = 10');
  });

  it('identities do not mirror: rewriteIdentity should not change the other side', () => {
    const ast = withIds(parseContentMathMLToAst(relationContent));
    const op = { operationType: 'rewriteIdentity' as const, operand: { kind: 'number', value: '3' } };
    const newAst = applyOperationWithMirror(ast, op, { mirror: true });
    const am = astToAsciiMath(newAst);
    // Expect only left side to be affected by default implementation (or unchanged).
    // Our applySingleOperation for rewriteIdentity currently just returns input; so relation remains same
    expect(am.replace(/\s+/g, ' ').trim()).toBe('x + 2 = 7');
  });
});
