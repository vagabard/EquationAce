import { describe, it, expect } from 'vitest';
import { parseAsciiMath } from '../lib/asciimath';

function expectContentHasTag(xml: string, tag: string) {
  expect(xml).toMatch(new RegExp(`<apply>\\s*<${tag}\\/?>`, 'i'));
}

function expectPresentationHasSymbol(xml: string, sym: string) {
  // we expect the presentation math to include the operator symbol in an <mo>
  expect(xml).toContain(`<mo>${sym}</mo>`);
}

describe('AsciiMath relations parsing', () => {
  it('parses equality x + 2 = 7', () => {
    const res = parseAsciiMath('x + 2 = 7');
    if (!res.ok) throw new Error('parse failed: ' + res.error.message);
    expectContentHasTag(res.contentMathML, 'eq');
    expectPresentationHasSymbol(res.presentationMathML, '=');
  });

  it('parses less-than and greater-than', () => {
    const lt = parseAsciiMath('x < 3');
    if (!lt.ok) throw new Error('parse failed');
    expectContentHasTag(lt.contentMathML, 'lt');
    expect(lt.presentationMathML).toContain('<mo>&lt;</mo>');

    const gt = parseAsciiMath('y > 2');
    if (!gt.ok) throw new Error('parse failed');
    expectContentHasTag(gt.contentMathML, 'gt');
    expect(gt.presentationMathML).toContain('<mo>&gt;</mo>');
  });

  it('parses <= and >=', () => {
    const le = parseAsciiMath('a <= b');
    if (!le.ok) throw new Error('parse failed');
    expectContentHasTag(le.contentMathML, 'leq');
    expect(le.presentationMathML).toContain('<mo>≤</mo>');

    const ge = parseAsciiMath('m >= n');
    if (!ge.ok) throw new Error('parse failed');
    expectContentHasTag(ge.contentMathML, 'geq');
    expect(ge.presentationMathML).toContain('<mo>≥</mo>');
  });
});
