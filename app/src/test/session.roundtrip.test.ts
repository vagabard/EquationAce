import { describe, it, expect } from 'vitest';
import { serializeSession, parseSession } from '../lib/session';

describe('session serialize/parse round-trip', () => {
  it('restores steps, activeStepId, and input format', () => {
    const steps = [
      {
        id: 's0',
        parentStepId: null,
        contentMathML: '<math><ci>x</ci></math>',
        presentationMathML: '<math><mi>x</mi></math>',
        selection: null,
        appliedRule: null,
      },
      {
        id: 's1',
        parentStepId: 's0',
        contentMathML: '<math><apply><power/><ci>x</ci><cn>2</cn></apply></math>',
        presentationMathML: '<math><msup><mi>x</mi><mn>2</mn></msup></math>',
        selection: null,
        appliedRule: 'power',
      },
    ];

    const json = serializeSession({ steps, activeStepId: 's1', input: '(x)^2', format: 'asciimath' });
    const parsed = parseSession(json);
    expect(parsed.activeStepId).toBe('s1');
    expect(parsed.input.source).toContain('^2');
    expect(parsed.steps.length).toBe(2);
    expect(parsed.edges.length).toBe(2);
    expect(parsed.steps[1].parentStepId).toBe('s0');
  });
});
