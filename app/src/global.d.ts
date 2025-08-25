import React from 'react';

declare global {
  interface Window {
    MathJax?: {
      typesetPromise: () => Promise<void>;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      // MathML elements (lowercase tag names to match JSX usage)
      math: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        xmlns?: string;
        display?: 'block' | 'inline';
      };
      mrow: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      mi: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      mo: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      mn: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      mfrac: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      msqrt: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      msup: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export {};