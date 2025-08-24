import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';

function mockMathJax() {
  // minimal MathJax to avoid script injection
  // @ts-ignore
  (window as any).MathJax = {
    typesetPromise: vi.fn(async () => {}),
  };
}

describe('Keyboard navigation for selection', () => {
  beforeEach(() => {
    mockMathJax();
  });

  it('Up/Down expands/contracts, Left/Right moves siblings, Enter opens options, Esc cancels', async () => {
    // Mock fetch to avoid real backend calls
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ options: [] }),
      text: async () => 'ok',
    } as any);

    render(<App />);

    const textarea = await screen.findByLabelText(/Expression/);
    fireEvent.change(textarea, { target: { value: 'a+b' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse/ }));

    const mathRegion = await screen.findByRole('group', { name: /Interactive math expression/i });
    (mathRegion as HTMLElement).focus();

    // Down: contract to first child -> 'a'
    fireEvent.keyDown(mathRegion, { key: 'ArrowDown' });
    expect((textarea as HTMLTextAreaElement).value.trim()).toBe('a');

    // Right: move to sibling -> 'b'
    fireEvent.keyDown(mathRegion, { key: 'ArrowRight' });
    expect((textarea as HTMLTextAreaElement).value.trim()).toBe('b');

    // Up: expand to parent -> 'a + b'
    fireEvent.keyDown(mathRegion, { key: 'ArrowUp' });
    expect((textarea as HTMLTextAreaElement).value.replace(/\s+/g, ' ').trim()).toBe('a + b');

    // Enter: open options (dialog appears)
    fireEvent.keyDown(mathRegion, { key: 'Enter' });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    // Esc: close options
    fireEvent.keyDown(mathRegion, { key: 'Escape' });
    // Allow time for state update
    expect(() => screen.getByRole('dialog')).toThrow();

    // Esc again: clear selection -> input remains full expression
    fireEvent.keyDown(mathRegion, { key: 'Escape' });
    expect((textarea as HTMLTextAreaElement).value.replace(/\s+/g, ' ').trim()).toBe('a + b');

    fetchMock.mockRestore();
  });
});
