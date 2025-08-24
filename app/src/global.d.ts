import React from 'react';

declare global {
  interface Window {
    MathJax?: {
      typesetPromise: () => Promise<void>;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      // MathML elements
      Math: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        xmlns?: string;
        display?: 'block' | 'inline';
      };
      Mrow: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      Mi: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      Mo: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      Mn: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      Mfrac: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      Msqrt: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      Msup: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export {};