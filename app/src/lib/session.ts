// Session serialization utilities for EquationAce (.eqace)
// Schema focuses on steps (Content MathML), edges (from parentStepId), input format, and metadata.

export type InputFormat = 'asciimath' | 'plaintext' | 'mathml';

export interface StepSession {
  id: string;
  parentStepId: string | null;
  contentMathML: string;
  presentationMathML: string;
  selection?: { nodeId: string } | null;
  appliedRule?: string | null;
}

export interface EqAceSession {
  version: 'eqace-1';
  savedAt: string; // ISO string
  metadata?: Record<string, unknown>;
  input: { source: string; format: InputFormat };
  steps: StepSession[];
  edges: Array<{ from: string | null; to: string }>; // redundant with parentStepId for clarity
  activeStepId: string | null;
}

export function buildEdges(steps: StepSession[]): Array<{ from: string | null; to: string }> {
  return steps.map(s => ({ from: s.parentStepId, to: s.id }));
}

export function serializeSession(params: {
  steps: StepSession[];
  activeStepId: string | null;
  input: string;
  format: InputFormat;
  metadata?: Record<string, unknown>;
}): string {
  const payload: EqAceSession = {
    version: 'eqace-1',
    savedAt: new Date().toISOString(),
    metadata: params.metadata || {},
    input: { source: params.input, format: params.format },
    steps: params.steps,
    edges: buildEdges(params.steps),
    activeStepId: params.activeStepId,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseSession(json: string): EqAceSession {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object') throw new Error('Invalid .eqace file: not an object');
  if (data.version !== 'eqace-1') throw new Error('Unsupported .eqace version');
  if (!data.steps || !Array.isArray(data.steps)) throw new Error('Invalid .eqace: missing steps');
  if (!data.input || typeof data.input.source !== 'string' || (data.input.format !== 'asciimath' && data.input.format !== 'plaintext' && data.input.format !== 'mathml')) {
    throw new Error('Invalid .eqace: bad input');
  }
  // Shallow validation for steps
  for (const s of data.steps as StepSession[]) {
    if (typeof s.id !== 'string') throw new Error('Invalid step: id');
    if (s.parentStepId !== null && typeof s.parentStepId !== 'string') throw new Error('Invalid step: parentStepId');
    if (typeof s.contentMathML !== 'string') throw new Error('Invalid step: contentMathML');
    if (typeof s.presentationMathML !== 'string') throw new Error('Invalid step: presentationMathML');
  }
  // Rebuild edges if not provided
  if (!Array.isArray(data.edges)) data.edges = buildEdges(data.steps);
  return data as EqAceSession;
}

export function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}
