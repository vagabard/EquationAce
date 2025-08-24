// Export utilities: convert MathML to SVG and compose steps into a PDF

async function ensureMathJax(): Promise<any> {
  const w: any = (window as any);

  // Helper: wait for MathJax readiness using startup.promise if available, else poll
  const waitForReady = async (timeoutMs = 15000) => {
    const start = Date.now();
    // If startup.promise is available, await it first
    if (w.MathJax && w.MathJax.startup && w.MathJax.startup.promise && typeof w.MathJax.startup.promise.then === 'function') {
      try {
        await w.MathJax.startup.promise;
      } catch {
        // ignore and fall back to polling below
      }
    }
    return new Promise<void>((resolve, reject) => {
      const check = () => {
        const mj = (window as any).MathJax;
        if (mj && typeof mj.typesetPromise === 'function') return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error('MathJax did not initialize in time'));
        setTimeout(check, 50);
      };
      check();
    });
  };

  // Fast path
  if (w.MathJax && typeof w.MathJax.typesetPromise === 'function') return w.MathJax;

  // Helper to dynamically import local MathJax bundle as a fallback (no network)
  async function importLocalMmlSvg(): Promise<void> {
    try {
      await import('mathjax/es5/mml-svg.js');
    } catch (e) {
      // Rethrow with clearer context
      throw new Error('Failed to initialize MathJax from local package');
    }
  }

  // Avoid duplicate script injection
  let script = document.getElementById('mathjax-script') as HTMLScriptElement | null;
  if (!script) {
    // Provide minimal configuration before loading
    w.MathJax = w.MathJax || {};
    // Options: disable menu; we don't need a11y speech/enrichment for exporting
    w.MathJax.options = { ...(w.MathJax.options || {}), enableMenu: false };
    // Explicitly disable a11y speech and enrichment to avoid loading SRE worker
    w.MathJax.a11y = { ...(w.MathJax.a11y || {}), speech: false, enrich: false };
    // Provide a safe SRE path in case something still references it
    w.MathJax.loader = { ...(w.MathJax.loader || {}), paths: { ...(w.MathJax.loader?.paths || {}), sre: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/sre' } };

    script = document.createElement('script');
    script.id = 'mathjax-script';
    script.type = 'text/javascript';
    script.async = true;
    // For export we only need MathML -> SVG, so load the smaller bundle
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/mml-svg.js';
    const ready = new Promise<void>((resolve, reject) => {
      script!.onload = () => resolve();
      script!.onerror = () => reject(new Error('Failed to load MathJax script'));
    });
    document.head.appendChild(script);
    try {
      await ready;
      // After load, wait for full readiness
      await waitForReady(20000);
    } catch (e) {
      // If CDN load fails, fall back to local import
      await importLocalMmlSvg();
      await waitForReady(20000);
    }
  } else {
    // If script exists, wait for readiness (it may still be initializing)
    try {
      await waitForReady(8000);
    } catch (e) {
      // Pre-existing script seems stalled or blocked. Try local dynamic import as fallback.
      await importLocalMmlSvg();
      await waitForReady(20000);
    }
  }

  const MJ = w.MathJax;
  if (!MJ || typeof MJ.typesetPromise !== 'function') {
    throw new Error('MathJax is not loaded');
  }
  return MJ;
}

export async function mathMLToSVG(mathML: string): Promise<string> {
  const MJ: any = await ensureMathJax();
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-10000px';
  container.style.top = '0';
  // Ensure wrapped in <math>
  const content = /<\s*math[\s>]/i.test(mathML)
    ? mathML
    : `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${mathML}</math>`;
  container.innerHTML = content;
  document.body.appendChild(container);
  try {
    await MJ.typesetPromise([container]);
    const svg = container.querySelector('svg');
    if (!svg) throw new Error('SVG not produced');
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    return svgString;
  } finally {
    document.body.removeChild(container);
  }
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(',');
  const base64 = parts[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function svgToPng(svgString: string, scale = 2): Promise<{ dataUrl: string; width: number; height: number; bytes: Uint8Array } | null> {
  // Parse width/height from SVG
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement as SVGSVGElement;
  let width = parseFloat(svgEl.getAttribute('width') || '') || 0;
  let height = parseFloat(svgEl.getAttribute('height') || '') || 0;
  const vb = svgEl.getAttribute('viewBox');
  if ((!width || !height) && vb) {
    const parts = vb.split(/\s+/).map(Number);
    if (parts.length === 4) {
      width = parts[2];
      height = parts[3];
    }
  }
  if (!width || !height) {
    width = 800;
    height = 200;
  }
  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      try {
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };
    img.src = url;
  });
  const dataUrl = canvas.toDataURL('image/png');
  const bytes = dataUrlToUint8Array(dataUrl);
  return { dataUrl, width: canvas.width, height: canvas.height, bytes };
}

