import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App', () => {
  it('renders hello world message', () => {
    render(<App />);
    expect(screen.getByText(/Hello World - Math Expression Rewriting App/i)).toBeInTheDocument();
  });

  it('displays system status', () => {
    render(<App />);
    expect(screen.getByText(/✅ Frontend: React \+ TypeScript \+ Vite/i)).toBeInTheDocument();
    expect(screen.getByText(/✅ MathML: Native rendering with MathJax fallback/i)).toBeInTheDocument();
  });

  it('shows MathML rendering demo section', () => {
    render(<App />);
    expect(screen.getByText(/MathML Rendering Demo/i)).toBeInTheDocument();
    expect(screen.getByText(/Native MathML:/i)).toBeInTheDocument();
    expect(screen.getByText(/MathJax Fallback:/i)).toBeInTheDocument();
  });
});