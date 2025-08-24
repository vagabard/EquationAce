import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';

function mockMathJax() {
  // Minimal MathJax to avoid script injection during tests
  // @ts-ignore
  (window as any).MathJax = { typesetPromise: async () => {} };
}

describe('Mirror mode UI indicator', () => {
  beforeEach(() => {
    mockMathJax();
  });

  it('renders a Mirror mode checkbox and toggles an ON indicator', async () => {
    render(<App />);

    const checkbox = await screen.findByLabelText(/Mirror mode/i);
    expect(checkbox).toBeInTheDocument();

    // Initially OFF indicator should be visible near the rendered section label appears later
    // Toggle on
    fireEvent.click(checkbox);

    // Indicator text should reflect ON
    const onIndicator = await screen.findByText(/Mirror mode ON/i);
    expect(onIndicator).toBeInTheDocument();
  });
});
