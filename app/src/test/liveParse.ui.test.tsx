import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';

describe('AsciiMath live parsing UI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('shows error instantly for malformed input and provides suggestions', () => {
    render(<App />);
    const ta = screen.getByTestId('expr-input') as HTMLTextAreaElement;

    // Make input invalid: missing closing parenthesis
    act(() => {
      fireEvent.change(ta, { target: { value: '(a+b' } });
    });

    // Error should appear immediately
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Parse error/i);
    // Suggestions should include parentheses hint
    const list = screen.getByTestId('error-suggestions');
    expect(list).toHaveTextContent(/Check parentheses/i);

    // Border should be red - style serializes as rgb(255, 107, 107)
    const styleAttr = ta.getAttribute('style') || '';
    expect(styleAttr).toContain('rgb(255, 107, 107)');
  });

  it('clears error when fixed and shows green border', () => {
    render(<App />);
    const ta = screen.getByTestId('expr-input') as HTMLTextAreaElement;

    // Invalid first
    act(() => {
      fireEvent.change(ta, { target: { value: '(a+b' } });
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Now fix
    act(() => {
      fireEvent.change(ta, { target: { value: '(a+b)' } });
    });

    // Error should be gone immediately
    expect(screen.queryByRole('alert')).toBeNull();

    // Green border
    const styleAttr = ta.getAttribute('style') || '';
    expect(styleAttr).toContain('rgb(76, 175, 80)');
  });

  it('debounces heavy parse/update to ~400ms', () => {
    const spy = vi.spyOn(window, 'setTimeout');
    render(<App />);
    const ta = screen.getByTestId('expr-input') as HTMLTextAreaElement;

    act(() => {
      fireEvent.change(ta, { target: { value: 'x+y' } });
    });

    // See if a debounce was scheduled at 400ms
    const has400 = spy.mock.calls.some((args) => args[1] === 400);
    expect(has400).toBe(true);
  });
});
