import { describe, it, expect } from 'vitest';
import { parseAsciiMath } from '../lib/asciimath';

function hasAll(haystack: string, needles: string[]) {
  return needles.every(n => haystack.toLowerCase().includes(n.toLowerCase()));
}

describe('AsciiMath parser basic functionality', () => {
  it('parses (a+b)^2 into Content MathML with plus and power', () => {
    const res = parseAsciiMath('(a+b)^2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(hasAll(res.contentMathML, ['<plus/>', '<power/>', '<ci>a</ci>', '<ci>b</ci>', '<cn>2</cn>'])).toBe(true);
    expect(res.presentationMathML).toMatch(/<msup/);
    // Ensure parentheses are shown around composite base in Presentation MathML
    expect(res.presentationMathML).toContain('<mo>(</mo>');
    expect(res.presentationMathML).toContain('<mo>)</mo>');
  });

  it('represents subtraction as addition of (-1)*rhs in Content MathML', () => {
    const res = parseAsciiMath('x - y');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // expect structure with <plus/> and inner <times/> with -1
    expect(hasAll(res.contentMathML, ['<plus/>', '<times/>', '<cn>-1</cn>'])).toBe(true);
  });

  it('parses multiplication x*y into <times/>', () => {
    const res = parseAsciiMath('x*y');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.contentMathML).toContain('<times/>');
  });

  it('renders sin(x)^2 with <msup> and function call in Presentation MathML', () => {
    const res = parseAsciiMath('sin(x)^2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.presentationMathML).toMatch(/<msup/);
    expect(res.presentationMathML).toMatch(/<mi>sin<\/mi>/);
  });
});
