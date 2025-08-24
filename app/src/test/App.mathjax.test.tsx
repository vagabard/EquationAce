import { render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import App from '../App';

// Helper to temporarily override head.appendChild
function withHeadAppendChildMock(fn: (mock: ReturnType<typeof vi.fn>) => void) {
  const original = document.head.appendChild;
  const mock = vi.fn((node: Node) => original.call(document.head, node));
  // @ts-expect-error override for testing
  document.head.appendChild = mock;
  try {
    fn(mock);
  } finally {
    document.head.appendChild = original;
  }
}

describe('MathJax fallback loader', () => {
  afterEach(() => {
    // Cleanup any injected script element
    const existing = document.getElementById('mathjax-script');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    // @ts-ignore
    delete (window as any).MathJax;
    vi.restoreAllMocks();
  });

  it('injects MathJax script and calls typesetPromise when MathJax is absent', async () => {
    // Ensure MathJax is not present
    // @ts-ignore
    delete (window as any).MathJax;

    // Intercept script injection: when the script is appended, simulate load and provide MathJax mock
    withHeadAppendChildMock((appendMock) => {
      // When script appended, simulate onload and typesetPromise
      appendMock.mockImplementation((node: any) => {
        if (node && node.tagName === 'SCRIPT') {
          // Provide a mock MathJax before calling onload
          const typesetPromise = vi.fn().mockResolvedValue([]);
          // @ts-ignore
          (window as any).MathJax = { typesetPromise };
          // Trigger script onload callback if present
          if (typeof node.onload === 'function') {
            node.onload(new Event('load'));
          }
          return node;
        }
        return Node.prototype.appendChild.call(document.head, node);
      });

      render(<App />);

      // Find the mock back and ensure it has been called
      const mj = (window as any).MathJax;
      expect(mj).toBeTruthy();
      expect(typeof mj.typesetPromise).toBe('function');
      // onload should have triggered typesetPromise synchronously
      expect(mj.typesetPromise).toHaveBeenCalled();
    });
  });

  it('does not inject duplicate MathJax script if already present', () => {
    // Provide a fake MathJax with a spy
    const typesetPromise = vi.fn().mockResolvedValue([]);
    // @ts-ignore
    (window as any).MathJax = { typesetPromise };

    withHeadAppendChildMock((appendMock) => {
      render(<App />);
      // Since MathJax already existed, we should not have appended a script
      expect(appendMock).not.toHaveBeenCalled();
      expect(typesetPromise).toHaveBeenCalled();
    });
  });
});
