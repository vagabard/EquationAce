import { render, screen, within, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

function mockMathJax() {
  // minimal MathJax to avoid script injection
  // @ts-ignore
  (window as any).MathJax = {
    typesetPromise: vi.fn(async () => {}),
  };
}

describe('Rewrite apply flow (mocked backend)', () => {
  beforeEach(() => {
    mockMathJax();
  });

  it('applies sin(x)^2 -> 1 - cos(x)^2 and appends a new step with sanitized input', async () => {
    // Mock fetch for rewriteOptions
    const replacementContent = '<math xmlns="http://www.w3.org/1998/Math/MathML"><apply><plus/><cn>1</cn><apply><times/><cn>-1</cn><apply><power/><apply><cos/><ci>x</ci></apply><cn>2</cn></apply></apply></apply></math>';
    const replacementPresentation = '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><mn>1</mn><mo>-</mo><msup><mrow><mrow><mi>cos</mi><mo>(</mo><mi>x</mi><mo>)</mo></mrow></mrow><mn>2</mn></msup></mrow></math>';
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ options: [ { id: 'opt1', label: 'sin^2 identity', ruleName: 'trig_identity_sin2', replacementContentMathML: replacementContent, replacementPresentationMathML: replacementPresentation } ] }),
      text: async () => 'ok',
    } as any);

    render(<App />);

    // Enter sin(x)^2 and parse
    const textarea = await screen.findByLabelText(/Expression/);
    fireEvent.change(textarea, { target: { value: 'sin(x)^2' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse/ }));

    // Select some node by simulating mousedown/up on the rendered math container child
    const interactive = await screen.findByText(/Rendered \(interactive\):/i);
    const container = interactive.parentElement as HTMLElement;
    const mathRegion = container.querySelector('[data-node-id]') as HTMLElement;
    expect(mathRegion).toBeTruthy();

    // Simulate selection via mouse down/up on the same element (LCA will be itself)
    fireEvent.mouseDown(mathRegion);
    fireEvent.mouseUp(mathRegion);

    // Click Get Rewrite Options
    fireEvent.click(screen.getByRole('button', { name: /Get Rewrite Options/i }));

    // In the popup, click Apply on the first option
    const dialog = await screen.findByRole('dialog', { hidden: true }).catch(() => document.getElementById('rewrite-options-container'));
    const applyBtn = within(dialog as HTMLElement).getByRole('button', { name: /^Apply$/ });
    fireEvent.click(applyBtn);

    // Steps list should have at least 2 items now
    const stepsHeading = await screen.findByText(/Steps:/i);
    const list = stepsHeading.nextElementSibling as HTMLElement;
    expect(list.querySelectorAll('li').length).toBeGreaterThanOrEqual(2);

    // Input should reflect sanitized "1 - cos(x)^2"
    await act(async () => {});
    expect((textarea as HTMLTextAreaElement).value).toContain('1 - cos(x)^2');

    fetchMock.mockRestore();
  });
});
