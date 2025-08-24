import { useEffect, useMemo, useState, useRef } from 'react';
import './App.css';
import { parseAsciiMath } from './lib/asciimath';
import { parsePlainText } from './lib/plaintext';
import { parseContentMathMLToAst, withIds as withIdsContent, findAndReplaceById, astToContentMathML, astToPresentationMathML, findNodeById, astToAsciiMath } from './lib/contentAst';
import { serializeSession, parseSession, triggerDownload } from './lib/session';

// Minimal global typing for MathJax on window
declare global {
  interface Window {
    MathJax?: any;
  }
}

function ensureMathJaxLoaded() {
  // If MathJax is already present, just typeset
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    window.MathJax.typesetPromise();
    return;
  }

  // Avoid duplicate script injection
  if (document.getElementById('mathjax-script')) {
    return;
  }

  // Configure MathJax before the script loads
  (window as any).MathJax = {
    options: {
      enableMenu: false,
    },
    // Disable a11y speech and enrichment to avoid loading SRE worker in the browser
    a11y: {
      speech: false,
      enrich: false,
    },
    // Provide a safe SRE path in case some component still references it
    loader: {
      paths: {
        sre: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/sre',
      },
    },
    asciimath: {
      // allow backtick `...` or no delimiters in our UI, we just convert programmatically
    },
    tex: {
      inlineMath: [
        ['$', '$'],
        ['\\(', '\\)'],
      ],
      displayMath: [
        ['$$', '$$'],
        ['\\[', '\\]'],
      ],
    },
  };

  const script = document.createElement('script');
  script.id = 'mathjax-script';
  script.type = 'text/javascript';
  script.async = true;
  // Use AsciiMath + MathML + SVG so we can export SVG for PDF generation
  script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/asciimath-mml-svg.js';
  script.onload = () => {
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      window.MathJax.typesetPromise();
    }
  };
  document.head.appendChild(script);
}

type Step = { id: string; parentStepId: string | null; contentMathML: string; presentationMathML: string; selection?: { nodeId: string } | null; appliedRule?: string | null };

function App() {
  useEffect(() => {
    ensureMathJaxLoaded();
  }, []);

  // UI state for AsciiMath parsing
  const [input, setInput] = useState('(a+b)^2');
  const [format, setFormat] = useState<'asciimath' | 'plaintext' | 'mathml'>('asciimath');
  // Step history and active selection
  const [steps, setSteps] = useState<Step[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; index?: number; near?: string } | null>(null);

  // Parse once on mount to populate initial rendering
  useEffect(() => {
    handleParse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleParse = () => {
    setError(null);

    let res: ReturnType<typeof parseAsciiMath> | ReturnType<typeof parsePlainText>;
    if (format === 'asciimath') {
      res = parseAsciiMath(input);
    } else if (format === 'plaintext') {
      res = parsePlainText(input);
    } else {
      setError({ message: 'MathML input is not supported in this UI yet.' });
      setIsValid(false);
      return;
    }
    if (res.ok) {
      const first: Step = {
        id: 's0',
        parentStepId: null,
        contentMathML: res.contentMathML,
        presentationMathML: res.presentationMathML,
        selection: null,
        appliedRule: null,
      };
      setSteps([first]);
      setActiveStepId(first.id);
      setIsValid(true);
    } else {
      setError(res.error);
      setIsValid(false);
    }
  };

  // Live-parse support: immediate validation + debounced rendering update
  const [isValid, setIsValid] = useState<boolean>(true);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function getSuggestions(src: string, err: { message: string; index?: number; near?: string } | null): string[] {
    if (!err) return [];
    const suggestions: string[] = [];
    // Parentheses balance
    const opens = (src.match(/\(/g) || []).length;
    const closes = (src.match(/\)/g) || []).length;
    if (opens !== closes) {
      suggestions.push('Check parentheses: make sure each "(" has a matching ")".');
    }
    // Missing operator between tokens: e.g., 2x or )(
    const i = typeof err.index === 'number' ? err.index : undefined;
    if (i !== undefined) {
      const left = src[i - 1] || '';
      const right = src[i] || '';
      const isAlphaNum = (ch: string) => /[A-Za-z0-9]/.test(ch);
      if ((isAlphaNum(left) || left === ')') && (isAlphaNum(right) || right === '(')) {
        suggestions.push('Insert an operator. For multiplication, use "*" (e.g., write "2*x" instead of "2x").');
      }
    }
    // Unsupported characters
    if (/(?:[^A-Za-z0-9_+\-*/^()=<>\s])/.test(src)) {
      suggestions.push('Remove or replace unsupported characters.');
    }
    // Function call hint
    if (/\b[a-zA-Z]+\($/.test(src.trim())) {
      suggestions.push('Complete the function call by adding an argument and a closing parenthesis, e.g., sin(x).');
    }
    return suggestions;
  }

  const handleInputChange = (value: string) => {
    setInput(value);

    // Instant validation using selected parser
    let quick: ReturnType<typeof parseAsciiMath> | ReturnType<typeof parsePlainText>;
    if (format === 'asciimath') quick = parseAsciiMath(value);
    else if (format === 'plaintext') quick = parsePlainText(value);
    else {
      setError({ message: 'MathML input is not supported in this UI yet.' });
      setIsValid(false);
      return;
    }
    if (quick.ok) {
      setError(null);
      setIsValid(true);
    } else {
      setError(quick.error);
      setIsValid(false);
    }

    // Debounced heavy update (steps/rendering)
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      const res = parseAsciiMath(value);
      if (res.ok) {
        const first: Step = {
          id: 's0',
          parentStepId: null,
          contentMathML: res.contentMathML,
          presentationMathML: res.presentationMathML,
          selection: null,
          appliedRule: null,
        };
        setSteps([first]);
        setActiveStepId(first.id);
      }
      // if invalid, keep prior rendering; error already shown instantly
    }, 400);
  };

  // Rendered presentation MathML node using dangerouslySetInnerHTML
  const activeStep = useMemo(() => steps.find(s => s.id === activeStepId) || null, [steps, activeStepId]);

  const presentationNode = useMemo(() => {
    if (!activeStep) return null;
    return { __html: activeStep.presentationMathML };
  }, [activeStep]);

  // Hover and selection state (by nodeId)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dragStartId, setDragStartId] = useState<string | null>(null);
  const interactiveRef = useRef<HTMLDivElement | null>(null);

  // Save/Load/Export controls
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleSaveSession() {
    try {
      const json = serializeSession({
        steps: steps.map(s => ({ ...s })),
        activeStepId,
        input,
        format,
        metadata: { app: 'EquationAce' },
      });
      const blob = new Blob([json], { type: 'application/json' });
      triggerDownload('session.eqace', blob);
    } catch (e: any) {
      alert('Failed to save session: ' + (e?.message || e));
    }
  }


  async function onLoadFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const session = parseSession(text);
      setSteps(session.steps as any);
      setActiveStepId(session.activeStepId || (session.steps[0]?.id ?? null));
      setSelectedNodeId(null);
      setHoverNodeId(null);
      setDragStartId(null);
      setFormat(session.input.format);
      setInput(session.input.source);
      setShowOptions(false);
      setRewriteOptions([]);
      // Re-typeset after DOM updates
      const MJ: any = (window as any).MathJax;
      if (MJ && typeof MJ.typesetPromise === 'function') {
        setTimeout(() => { MJ.typesetPromise().catch(() => {}); }, 0);
      }
    } catch (e: any) {
      alert('Failed to load session: ' + (e?.message || e));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Keep the textarea in sync with selection and format using MathJax when possible.
  useEffect(() => {
    if (!activeStep) return;

    async function convertAndSet(textForMathML: string, fallbackAsciiFromAst?: string) {
      function sanitizeAscii(s: string): string {
        // Replace Python-style power with AsciiMath power and trim redundant spaces
        return s.replace(/\*\*/g, '^').replace(/\s+/g, ' ').trim();
      }
      // Try to use MathJax to convert MathML -> selected format
      try {
        if (format === 'mathml') {
          setInput(textForMathML);
          return;
        }
        if (format === 'asciimath') {
          const MJ: any = (window as any).MathJax;
          // Some MathJax bundles expose a convenience method for conversions; use if available
          if (MJ && typeof MJ.mathml2asciimath === 'function') {
            const am = await MJ.mathml2asciimath(textForMathML);
            if (am && typeof am === 'string') {
              setInput(sanitizeAscii(am));
              return;
            }
          }
          // Fallback to local converter from AST if MathJax API is not available
          if (fallbackAsciiFromAst) {
            setInput(sanitizeAscii(fallbackAsciiFromAst));
            return;
          }
        }
        // Default fallback to provided MathML
        setInput(textForMathML);
      } catch {
        // On error, prefer fallback ascii or MathML
        if (fallbackAsciiFromAst) setInput(sanitizeAscii(fallbackAsciiFromAst)); else setInput(textForMathML);
      }
    }

    if (selectedNodeId) {
      try {
        const baseAst = withIdsContent(parseContentMathMLToAst(activeStep.contentMathML));
        const sub = findNodeById(baseAst, selectedNodeId);
        if (sub) {
          const subPres = astToPresentationMathML(sub);
          const fallbackAscii = astToAsciiMath(sub);
          convertAndSet(subPres, fallbackAscii);
          return;
        }
      } catch {
        // fall back to full expression below
      }
    }
    // Fallback (no selection): show full expression in chosen format
    try {
      const baseAst = withIdsContent(parseContentMathMLToAst(activeStep.contentMathML));
      const fullPres = astToPresentationMathML(baseAst);
      const fallbackAscii = astToAsciiMath(baseAst);
      convertAndSet(fullPres, fallbackAscii);
    } catch {
      // If parsing fails, fall back to presentation MathML directly
      convertAndSet(activeStep.presentationMathML);
    }
  }, [activeStep, selectedNodeId, format]);

  // Debug: log selected AST node when selection changes
  useEffect(() => {
    if (!activeStep || !selectedNodeId) return;
    try {
      const baseAst = withIdsContent(parseContentMathMLToAst(activeStep.contentMathML));
      const sub = findNodeById(baseAst, selectedNodeId);
      if (sub) {
        console.debug('[Debug] Selected AST node for rewrite:', sub);
      } else {
        console.debug('[Debug] Selected node id not found in AST:', selectedNodeId);
      }
    } catch (e) {
      console.debug('[Debug] Failed to parse AST for selection logging:', e);
    }
  }, [activeStep, selectedNodeId]);

  // Rewrite options popup state
  const [showOptions, setShowOptions] = useState(false);
  const [rewriteOptions, setRewriteOptions] = useState<Array<{ id: string; label: string; ruleName: string; replacementContentMathML: string; replacementPresentationMathML: string }>>([]);

  // Mirror mode UI state (indicator only for now)
  const [mirrorMode, setMirrorMode] = useState(false);

  // Re-typeset MathJax when options popup opens or updates
  useEffect(() => {
    if (showOptions && window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      // Limit typesetting to the popup container if possible
      const container = document.getElementById('rewrite-options-container');
      if (container) {
        window.MathJax.typesetPromise([container]).catch(() => window.MathJax.typesetPromise());
      } else {
        window.MathJax.typesetPromise();
      }
    }
  }, [showOptions, rewriteOptions]);

  // Event handlers on container with delegated behavior
  function findNodeIdFromEventTarget(target: EventTarget | null): string | null {
    if (!target || !(target as Element).closest) return null;
    const el = (target as Element).closest('[data-node-id]') as HTMLElement | null;
    return el ? el.getAttribute('data-node-id') : null;
  }

  // Build navigation index (parent/children) from current Content AST
  const navIndex = useMemo(() => {
    if (!activeStep) return null as null | { rootId: string; parent: Map<string, string | null>; children: Map<string, string[]> };
    try {
      const baseAst = withIdsContent(parseContentMathMLToAst(activeStep.contentMathML));
      const parent = new Map<string, string | null>();
      const children = new Map<string, string[]>();
      function add(n: any, pid: string | null) {
        const id = (n as any).id as string;
        parent.set(id, pid);
        let kids: any[] = [];
        switch (n.kind) {
          case 'ident':
          case 'number':
            kids = [];
            break;
          case 'power':
            kids = [n.base, n.exponent];
            break;
          case 'add':
            kids = n.terms;
            break;
          case 'mul':
            kids = n.factors;
            break;
          case 'call':
            kids = [n.arg];
            break;
          case 'rel':
            kids = [n.left, n.right];
            break;
        }
        children.set(id, kids.map((k: any) => (k as any).id));
        for (const k of kids) add(k, id);
      }
      add(baseAst as any, null);
      return { rootId: (baseAst as any).id as string, parent, children };
    } catch {
      return null;
    }
  }, [activeStep]);

  function onMouseMove(e: React.MouseEvent) {
    const id = findNodeIdFromEventTarget(e.target);
    setHoverNodeId(id);
  }
  function onMouseLeave() {
    setHoverNodeId(null);
  }
  function onMouseDown(e: React.MouseEvent) {
    const id = findNodeIdFromEventTarget(e.target);
    setDragStartId(id);
    // Focus keyboard container for accessibility
    if (interactiveRef.current) {
      interactiveRef.current.focus();
    }
  }
  function onMouseUp(e: React.MouseEvent) {
    const endEl = (e.target as Element).closest('[data-node-id]') as HTMLElement | null;
    const startId = dragStartId;
    setDragStartId(null);
    if (!startId || !endEl) return;
    const startEl = (document.querySelector(`[data-node-id="${CSS.escape(startId)}"]`) as HTMLElement) || null;
    if (!startEl) return;
    // Compute LCA that has data-node-id
    const startAncestors = new Set<string>();
    let cur: HTMLElement | null = startEl;
    while (cur) {
      const id = cur.getAttribute('data-node-id');
      if (id) startAncestors.add(id);
      cur = cur.parentElement as HTMLElement | null;
    }
    let cur2: HTMLElement | null = endEl;
    let lcaId: string | null = null;
    while (cur2) {
      const id = cur2.getAttribute('data-node-id');
      if (id && startAncestors.has(id)) {
        lcaId = id;
        break;
      }
      cur2 = cur2.parentElement as HTMLElement | null;
    }
    if (lcaId) {
      setSelectedNodeId(lcaId);
    }
  }

  async function fetchRewriteOptionsForSelected() {
    if (!activeStep || !selectedNodeId) return;
    try {
      try {
        const baseAst = withIdsContent(parseContentMathMLToAst(activeStep.contentMathML));
        const sub = findNodeById(baseAst, selectedNodeId);
        console.debug('[Debug] Requesting rewrite options for selected AST:', sub);
      } catch (e) {
        console.debug('[Debug] Failed to build AST for rewrite options:', e);
      }
      const resp = await fetch('http://localhost:8000/rewriteOptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentMathML: activeStep.contentMathML, selectedNodeId })
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setRewriteOptions(data.options || []);
      setShowOptions(true);
    } catch (e: any) {
      alert('Failed to fetch rewrite options: ' + (e?.message || e));
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!navIndex) return;
    let current = selectedNodeId ?? navIndex.rootId;
    switch (e.key) {
      case 'ArrowUp': {
        const pid = navIndex.parent.get(current);
        if (pid) {
          setSelectedNodeId(pid);
        }
        e.preventDefault();
        break;
      }
      case 'ArrowDown': {
        const kids = navIndex.children.get(current) || [];
        if (kids.length > 0) {
          setSelectedNodeId(kids[0]);
        }
        e.preventDefault();
        break;
      }
      case 'ArrowLeft': {
        const pid = navIndex.parent.get(current);
        if (pid) {
          const siblings = navIndex.children.get(pid) || [];
          const idx = siblings.indexOf(current);
          if (idx > 0) setSelectedNodeId(siblings[idx - 1]);
        }
        e.preventDefault();
        break;
      }
      case 'ArrowRight': {
        const pid = navIndex.parent.get(current);
        if (pid) {
          const siblings = navIndex.children.get(pid) || [];
          const idx = siblings.indexOf(current);
          if (idx >= 0 && idx < siblings.length - 1) setSelectedNodeId(siblings[idx + 1]);
        }
        e.preventDefault();
        break;
      }
      case 'Enter': {
        // Open options for current selection (fetch if backend available)
        if (!selectedNodeId) setSelectedNodeId(current);
        fetchRewriteOptionsForSelected();
        e.preventDefault();
        break;
      }
      case 'Escape': {
        if (showOptions) setShowOptions(false); else setSelectedNodeId(null);
        e.preventDefault();
        break;
      }
    }
  }

	return (
    <div className="app">
      <header className="app-header">
        <h1>Hello World - Math Expression Rewriting App</h1>
        <p>Computer Assisted Math Expression Rewriting Web Application</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
          <button onClick={handleSaveSession}>Save (.eqace)</button>
          <button onClick={() => fileInputRef.current?.click()}>Load (.eqace)</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".eqace,application/json"
            style={{ display: 'none' }}
            onChange={onLoadFileChange}
          />
        </div>
      </header>

      <main className="app-main">
        <section className="math-demo">
          <h2>MathML Rendering Demo</h2>
          
          {/* Native MathML (primary) */}
          <div className="math-container">
            <h3>Native MathML:</h3>
            <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
              <mrow>
                <mi>x</mi>
                <mo>=</mo>
                <mfrac>
                  <mrow>
                    <mo>-</mo>
                    <mi>b</mi>
                    <mo>±</mo>
                    <msqrt>
                      <mrow>
                        <msup>
                          <mi>b</mi>
                          <mn>2</mn>
                        </msup>
                        <mo>-</mo>
                        <mn>4</mn>
                        <mi>a</mi>
                        <mi>c</mi>
                      </mrow>
                    </msqrt>
                  </mrow>
                  <mrow>
                    <mn>2</mn>
                    <mi>a</mi>
                  </mrow>
                </mfrac>
              </mrow>
            </math>
          </div>

          {/* MathJax fallback */}
          <div className="math-container">
            <h3>MathJax Fallback:</h3>
            <div>
              {'$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'}
            </div>
          </div>
        </section>

        {/* New: AsciiMath parsing section */}
        <section className="parser">
          <h2>Expression Parser</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 320, maxWidth: 600, width: '100%' }}>
              <label htmlFor="expr">Expression (reflects rendered MathML after rewrites):</label>
              <textarea
                id="expr"
                data-testid="expr-input"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                rows={4}
                aria-invalid={format !== 'mathml' && input.trim() !== '' ? (!isValid) : undefined}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 6,
                  outline: 'none',
                  border: `2px solid ${format !== 'asciimath' || input.trim() === '' ? '#666' : (isValid ? '#4caf50' : '#ff6b6b')}`,
                  boxShadow: 'none',
                  transition: 'border-color 0.15s ease-in-out'
                }}
                placeholder="Enter AsciiMath, e.g., sin(x)^2"
              />
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label htmlFor="format">Input format:</label>
                <select id="format" value={format} onChange={(e) => setFormat(e.target.value as any)}>
                  <option value="asciimath">AsciiMath</option>
                  <option value="plaintext">PlainText</option>
                  <option value="mathml">MathML (not yet supported)</option>
                  <option value="latex" disabled>LaTeX (disabled)</option>
                </select>
                <button onClick={handleParse}>Parse</button>
                <label htmlFor="mirrorMode" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: '0.5rem' }}>
                  <input
                    id="mirrorMode"
                    type="checkbox"
                    checked={mirrorMode}
                    onChange={(e) => setMirrorMode(e.target.checked)}
                  />
                  Mirror mode
                </label>
              </div>
              {error && (
                <div role="alert" style={{ color: '#ff6b6b', marginTop: '0.5rem', textAlign: 'left' }}>
                  <strong>Parse error:</strong> {error.message}
                  {typeof error.index === 'number' && (
                    <span> at index {error.index}{error.near ? ` near "${error.near}"` : ''}</span>
                  )}
                  {(() => {
                    const tips = getSuggestions(input, error);
                    return tips.length ? (
                      <ul data-testid="error-suggestions" style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                        {tips.map((t, i) => (
                          <li key={i} style={{ color: '#ffa8a8' }}>{t}</li>
                        ))}
                      </ul>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Render Presentation MathML if available */}
          {presentationNode && (
            <div className="math-container" style={{ marginTop: '1rem' }}>
              <h3>Rendered (interactive):</h3>
              <div aria-live="polite" style={{ marginBottom: '0.25rem' }}>
                <span
                  title={mirrorMode ? 'Mirror mode is active' : 'Mirror mode is off'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 12,
                    background: mirrorMode ? 'rgba(80,200,120,0.15)' : 'rgba(160,160,160,0.1)',
                    border: `1px solid ${mirrorMode ? '#4caf50' : '#666'}`,
                    color: mirrorMode ? '#c8e6c9' : '#ddd',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: mirrorMode ? '#4caf50' : '#777' }} />
                  Mirror mode {mirrorMode ? 'ON' : 'OFF'}
                </span>
              </div>
              {/* dynamic styles for hover/selection */}
              <style>{`
                [data-node-id] { cursor: default; }
                ${hoverNodeId ? `[data-node-id="${hoverNodeId}"] { outline: 2px solid #66d9ef; outline-offset: 2px; }` : ''}
                ${selectedNodeId ? `[data-node-id="${selectedNodeId}"] { background-color: rgba(255, 215, 0, 0.2); outline: 2px solid gold; outline-offset: 2px; }` : ''}
              `}</style>
              <div
                ref={interactiveRef}
                tabIndex={0}
                role="group"
                aria-label="Interactive math expression"
                onKeyDown={onKeyDown}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                style={{ display: 'inline-block', padding: 4, borderRadius: 6, outline: 'none' }}
                dangerouslySetInnerHTML={presentationNode}
              />
              {selectedNodeId && (
                <div style={{ marginTop: '0.5rem', fontSize: 14, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span>Selection nodeId: <code>{selectedNodeId}</code></span>
                  <button onClick={async () => {
                    if (!activeStep || !selectedNodeId) return;
                    try {
                      // Debug: log selected AST being requested for rewrite
                      try {
                        const baseAst = withIdsContent(parseContentMathMLToAst(activeStep.contentMathML));
                        const sub = findNodeById(baseAst, selectedNodeId);
                        console.debug('[Debug] Requesting rewrite options for selected AST:', sub);
                      } catch (e) {
                        console.debug('[Debug] Failed to build AST for rewrite options:', e);
                      }
                      const resp = await fetch('http://localhost:8000/rewriteOptions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contentMathML: activeStep.contentMathML, selectedNodeId })
                      });
                      if (!resp.ok) throw new Error(await resp.text());
                      const data = await resp.json();
                      setRewriteOptions(data.options || []);
                      setShowOptions(true);
                    } catch (e: any) {
                      alert('Failed to fetch rewrite options: ' + (e?.message || e));
                    }
                  }}>Get Rewrite Options</button>
                </div>
              )}
            </div>
          )}

          {/* Steps history */}
          {steps.length > 0 && (
            <div style={{ marginTop: '1rem', textAlign: 'left' }}>
              <h3>Steps:</h3>
              <ol style={{ paddingLeft: '1.25rem' }}>
                {steps.map((s, idx) => (
                  <li key={s.id} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => { setActiveStepId(s.id); setSelectedNodeId(null); }}
                        style={{ padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid #555', background: activeStepId === s.id ? '#2d2d2d' : '#1e1e1e', color: '#eee' }}
                        title={s.appliedRule ? `Rule: ${s.appliedRule}` : 'Initial'}
                      >
                        {activeStepId === s.id ? 'Active' : 'Select'}
                      </button>
                      <span>Step {idx}{s.appliedRule ? ` — rule: ${s.appliedRule}` : ' — initial'}</span>
                    </div>
                    <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: s.presentationMathML }} />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section className="status">
          <h2>System Status</h2>
          <p>✅ Frontend: React + TypeScript + Vite</p>
          <p>✅ MathML: Native rendering with MathJax fallback</p>
          <p>⏳ Backend: FastAPI + Python (pending)</p>
          <p>⏳ API Contracts: Parse/Rewrite endpoints (pending)</p>
        </section>
      </main>

      {showOptions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowOptions(false)}>
          <div id="rewrite-options-container" role="dialog" aria-modal="true" style={{ background: '#1e1e1e', color: '#eee', padding: '1rem', borderRadius: 8, maxWidth: 600, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Rewrite Options</h3>
              <button onClick={() => setShowOptions(false)}>Close</button>
            </div>
            {rewriteOptions.length === 0 ? (
              <div>No options available for the current selection.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 400, overflowY: 'auto' }}>
                {rewriteOptions.map((opt) => {
                  // Build an equality line: [selected subtree] = [replacement]
                  let equalityHTML = '';
                  let replacementInner = '';
                  try {
                    const selEl = selectedNodeId ? document.querySelector(`[data-node-id="${CSS.escape(selectedNodeId)}"]`) as HTMLElement | null : null;
                    const selHTML = selEl ? selEl.outerHTML : '';
                    // Extract inner of replacement <math> to avoid nested <math>
                    try {
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(opt.replacementPresentationMathML, 'text/html');
                      const m = doc.querySelector('math');
                      if (m) {
                        replacementInner = Array.from(m.childNodes).map((n) => (n as HTMLElement).outerHTML || n.textContent || '').join('');
                      } else {
                        replacementInner = opt.replacementPresentationMathML;
                      }
                    } catch {
                      replacementInner = opt.replacementPresentationMathML;
                    }
                    equalityHTML = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow>${selHTML}<mo>=</mo>${replacementInner}</mrow></math>`;
                  } catch {
                    equalityHTML = '';
                  }
                  return (
                    <li
                      key={opt.id}
                      style={{ border: '1px solid #333', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.5rem', background: '#232323' }}
                   >
                      <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 6 }}>
                        {equalityHTML ? (
                          <div dangerouslySetInnerHTML={{ __html: equalityHTML }} />
                        ) : (
                          <span>{opt.label}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div dangerouslySetInnerHTML={{ __html: opt.replacementPresentationMathML }} />
                        <button onClick={() => {
                          if (!activeStep || !selectedNodeId) return;
                          try {
                            // Update Content MathML via AST replacement
                            const baseAst = withIdsContent(parseContentMathMLToAst(activeStep.contentMathML));
                            let replAst = withIdsContent(parseContentMathMLToAst(opt.replacementContentMathML));
                            // Guard: if replacement content degraded to a single identifier like "1 - cos(x)**2",
                            // try to interpret it as AsciiMath by normalizing and reparsing to restore structure.
                            if ((replAst as any).kind === 'ident') {
                              const name = (replAst as any).name as string;
                              if (/[+\-*/()^]|\*\*/.test(name)) {
                                const normalized = name.replace(/\*\*/g, '^').replace(/\s+/g, '');
                                const parsed = parseAsciiMath(normalized);
                                if (parsed.ok) {
                                  try {
                                    replAst = withIdsContent(parseContentMathMLToAst(parsed.contentMathML));
                                  } catch {
                                    // keep original replAst if parsing fails
                                  }
                                }
                              }
                            }
                            // Debug: log chosen rule AST and returned AST from dialog
                            console.debug('[Debug] Chosen rewrite rule:', opt.ruleName, 'AST:', replAst);
                            console.debug('[Debug] AST returned from rewrite dialog:', replAst);
                            const newAst = findAndReplaceById(baseAst, selectedNodeId, replAst);
                            const newContent = astToContentMathML(newAst);
                            // Regenerate Presentation MathML with data-node-id across the whole expression
                            const newPresentation = astToPresentationMathML(newAst);
                            // Create and append new step
                            const newStep: Step = {
                              id: 's' + (steps.length),
                              parentStepId: activeStep.id,
                              contentMathML: newContent,
                              presentationMathML: newPresentation,
                              selection: null,
                              appliedRule: opt.ruleName,
                            };
                            setSteps(prev => [...prev, newStep]);
                            setActiveStepId(newStep.id);
                            setShowOptions(false);
                          } catch (e: any) {
                            alert('Failed to apply rewrite: ' + (e?.message || e));
                          }
                        }}>Apply</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App
