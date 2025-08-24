import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';

function mockMathJaxConversion(result: string) {
  // @ts-ignore
  (window as any).MathJax = {
    mathml2asciimath: vi.fn(async (_: string) => result),
    typesetPromise: vi.fn(async () => {}),
  };
}

describe('App syncing and MathJax sanitization', () => {
  it('sanitizes ** to ^ when MathJax conversion returns pythonic power', async () => {
    mockMathJaxConversion('1 - cos(x)**2');
    render(<App />);

    // Ensure initial parse runs and then input reflects full expression; set input to sin(x)^2 and parse
    const textarea = await screen.findByLabelText(/Expression/);
    fireEvent.change(textarea, { target: { value: 'sin(x)^2' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse/ }));

    // After render and sync effect, input should be sanitized (no **)
    await act(async () => {});
    expect((textarea as HTMLTextAreaElement).value).toContain('^2');
    expect((textarea as HTMLTextAreaElement).value).not.toContain('**');
  });

  it('switching format to MathML sets input to MathML string', async () => {
    // Provide minimal MathJax (no converter) to avoid script injection flakiness
    // @ts-ignore
    (window as any).MathJax = { typesetPromise: vi.fn(async () => {}) };
    render(<App />);
    // Choose MathML
    const select = screen.getByLabelText(/Input format/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'mathml' } });
    // Typeset effect runs; input should now look like MathML (<math ...)
    const textarea = await screen.findByLabelText(/Expression/);
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toMatch(/<math[\s\S]*<\/math>/);
    });
  });
});
