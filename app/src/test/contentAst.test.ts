import { describe, it, expect } from 'vitest';
import { parseContentMathMLToAst, astToPresentationMathML, astToAsciiMath, withIds, findAndReplaceById, astToContentMathML } from '../lib/contentAst';

function wrap(mathInner: string) {
  return `<math xmlns="http://www.w3.org/1998/Math/MathML">${mathInner}</math>`;
}

describe('Content AST utilities', () => {
  it('renders 1 - cos(x)^2 with a proper minus sign and dot for products', () => {
    const content = wrap('<apply><plus/><cn>1</cn><apply><times/><cn>-1</cn><apply><power/><apply><cos/><ci>x</ci></apply><cn>2</cn></apply></apply></apply>');
    const ast = withIds(parseContentMathMLToAst(content));
    const pres = astToPresentationMathML(ast);
    expect(pres).toMatch(/<mo[^>]*>-<\/mo>/);
    // ensure msup for cos(x)^2
    expect(pres).toMatch(/<msup/);
  });

  it('astToAsciiMath prints "1 - cos(x)^2" (no **) ', () => {
    const content = wrap('<apply><plus/><cn>1</cn><apply><times/><cn>-1</cn><apply><power/><apply><cos/><ci>x</ci></apply><cn>2</cn></apply></apply></apply>');
    const ast = withIds(parseContentMathMLToAst(content));
    const am = astToAsciiMath(ast);
    expect(am).toContain('1 - cos(x)^2');
    expect(am).not.toContain('**');
  });

  it('findAndReplaceById replaces a subtree and regenerates content/presentation', () => {
    // base: (a+b)^2
    const base = wrap('<apply><power/><apply><plus/><ci>a</ci><ci>b</ci></apply><cn>2</cn></apply>');
    const baseAst = withIds(parseContentMathMLToAst(base));
    // replacement: c
    const repl = withIds(parseContentMathMLToAst(wrap('<ci>c</ci>')));
    const targetId = (baseAst as any).base?.id || (baseAst as any).id; // replace the (a+b) if possible
    const newAst = findAndReplaceById(baseAst, targetId, repl);
    const newContent = astToContentMathML(newAst);
    const newPres = astToPresentationMathML(newAst);
    expect(newContent).toContain('<ci>c</ci>');
    expect(newPres).toMatch(/<msup/);
  });
});
