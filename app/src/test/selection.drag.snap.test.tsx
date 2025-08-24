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

describe('Drag selection snaps to smallest covering subtree and AST node', () => {
  beforeEach(() => {
    mockMathJax();
  });

  it('dragging across a+b snaps selection to a+b node', async () => {
    render(<App />);

    const textarea = await screen.findByLabelText(/Expression/);
    fireEvent.change(textarea, { target: { value: 'a+b' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse/ }));

    // Find interactive math container
    const mathRegion = await screen.findByRole('group', { name: /Interactive math expression/i });

    // Find the DOM nodes for 'a' and 'b'
    const aEl = (mathRegion as HTMLElement).querySelector('mi:nth-of-type(1)') as HTMLElement | null;
    const bEl = (mathRegion as HTMLElement).querySelector('mi:nth-of-type(2)') as HTMLElement | null;
    expect(aEl && bEl).toBeTruthy();

    // Simulate dragging from a to b
    fireEvent.mouseDown(aEl!);
    fireEvent.mouseUp(bEl!);

    // After selection, the input should reflect the selected subtree "a + b"
    const updated = (await screen.findByLabelText(/Expression/)) as HTMLTextAreaElement;
    expect(updated.value.replace(/\s+/g, ' ').trim()).toBe('a + b');
  });
});
