import '@testing-library/jest-dom';

// Define capitalized MathML elements for JSX runtime (excluding Math to avoid conflict)
declare global {
  // eslint-disable-next-line no-var
  var Mrow: any;
  // eslint-disable-next-line no-var
  var Mi: any;
  // eslint-disable-next-line no-var
  var Mo: any;
  // eslint-disable-next-line no-var
  var Mn: any;
  // eslint-disable-next-line no-var
  var Mfrac: any;
  // eslint-disable-next-line no-var
  var Msqrt: any;
  // eslint-disable-next-line no-var
  var Msup: any;
}

// Create runtime definitions for capitalized MathML elements (excluding Math)
globalThis.Mrow = 'mrow';
globalThis.Mi = 'mi';
globalThis.Mo = 'mo';
globalThis.Mn = 'mn';
globalThis.Mfrac = 'mfrac';
globalThis.Msqrt = 'msqrt';
globalThis.Msup = 'msup';

// Global test setup for Vitest
beforeEach(() => {
  // Reset any mocks or test state if needed
});

afterEach(() => {
  // Cleanup after each test
});