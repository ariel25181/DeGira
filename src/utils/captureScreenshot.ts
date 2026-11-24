/**
 * Synchronous lightweight screen snapshot + compressed image attachment reader
 * for FeedbackModal without triggering browser screen-sharing permissions
 * or crashing on Tailwind v4 oklch() colors.
 */

export function captureAppScreenshotSync(): string | undefined {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return undefined;
  }

  try {
    const canvas = document.createElement('canvas');
    const width = 720;
    const height = 460;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return undefined;

    // Background matching slate-950
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Header bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, 56);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, 56);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('DeGira • Captura Automática de Pantalla', 20, 34);

    // Metadata strip
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    const meta = `${window.innerWidth}x${window.innerHeight} • ${new Date().toLocaleTimeString('es-AR')} • ${window.location.pathname || '/'}`;
    ctx.fillText(meta.slice(0, 92), 20, 80);

    // Collect visible headings & status snippets from DOM before opening modal
    const snippets: string[] = [];
    const elements = document.querySelectorAll('h1, h2, h3, [data-testid="cloud-sync-bar"], button');
    elements.forEach((el) => {
      if (snippets.length >= 12) return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length >= 4 && !snippets.includes(text)) {
        snippets.push(text.slice(0, 82));
      }
    });

    // Content card
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 98, width - 40, height - 118);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(20, 98, width - 40, height - 118);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Elementos visibles en pantalla al abrir el reporte:', 36, 126);

    ctx.font = '13px sans-serif';
    snippets.forEach((line, idx) => {
      const y = 156 + idx * 24;
      if (y > height - 30) return;
      ctx.fillStyle = idx === 0 ? '#fbbf24' : '#cbd5e1';
      ctx.fillText(`• ${line}`, 36, y);
    });

    return canvas.toDataURL('image/png');
  } catch {
    return undefined;
  }
}

export async function readImageFilesAsDataUrls(
  files: FileList | File[],
  maxCount = 5
): Promise<string[]> {
  const list = Array.from(files).slice(0, maxCount);
  const results: string[] = [];

  for (const file of list) {
    if (!file || (file.type && !file.type.startsWith('image/'))) continue;
    let rawDataUrl = '';
    if (typeof FileReader !== 'undefined') {
      rawDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    } else if (typeof file.arrayBuffer === 'function') {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = typeof btoa === 'function' ? btoa(binary) : '';
      rawDataUrl = b64 ? `data:${file.type || 'image/png'};base64,${b64}` : '';
    }
    if (!rawDataUrl) continue;

    const compressed = await compressDataUrlIfPossible(rawDataUrl);
    results.push(compressed || rawDataUrl);
  }

  return results;
}

async function compressDataUrlIfPossible(dataUrl: string): Promise<string> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return dataUrl;
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const timer = setTimeout(() => resolve(dataUrl), 400);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const maxDim = 960;
          const scale = Math.min(1, maxDim / Math.max(img.width || maxDim, img.height || maxDim));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((img.width || 640) * scale));
          canvas.height = Math.max(1, Math.round((img.height || 480) * scale));
          const ctx = canvas.getContext?.('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.78) || dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(dataUrl);
      };
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}
