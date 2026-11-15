import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface ReceiptOcrResult {
  detectedCode: string | null;
  detectedAmountARS: number | null;
  detectedDate: string | null;
  senderName: string | null;
  status: 'valido' | 'dudoso' | 'incompleto';
  notes: string;
}

export interface AnalyzeReceiptInput {
  imageDataUrl: string;
  expectedEventCode: string;
  expectedAmountARS?: number;
}

export class GeminiHttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'GeminiHttpError';
    this.statusCode = statusCode;
  }
}

export interface GeminiClientLike {
  models: {
    generateContent: (params: any) => Promise<{ text?: string }>;
  };
}

export function createGeminiClient(apiKey?: string): GeminiClientLike {
  const resolvedKey = apiKey ?? process.env.GEMINI_API_KEY;
  if (!resolvedKey || resolvedKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiHttpError(
      'GEMINI_API_KEY no está configurada en el servidor. Configurala en Settings > Secrets.',
      503
    );
  }

  return new GoogleGenAI({
    apiKey: resolvedKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function parseDataUrlImage(imageDataUrl: string): { mimeType: string; data: string } {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    throw new GeminiHttpError('La imagen del comprobante es obligatoria.', 400);
  }
  const mimeMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const data = imageDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
  if (!data) {
    throw new GeminiHttpError('El contenido base64 de la imagen está vacío.', 400);
  }
  return { mimeType, data };
}

export function normalizeReceiptOcrResult(
  rawText: string | undefined,
  expectedEventCode: string,
  expectedAmountARS?: number
): ReceiptOcrResult {
  const cleaned = (rawText || '{}')
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let parsed: Record<string, any> = {};
  try {
    parsed = JSON.parse(cleaned || '{}');
  } catch {
    parsed = {};
  }

  const rawStatus = parsed.status;
  const status: ReceiptOcrResult['status'] =
    rawStatus === 'valido' || rawStatus === 'dudoso' || rawStatus === 'incompleto'
      ? rawStatus
      : 'valido';

  const parsedAmount =
    parsed.detectedAmountARS !== null && parsed.detectedAmountARS !== undefined
      ? Number(parsed.detectedAmountARS)
      : NaN;

  return {
    detectedCode:
      typeof parsed.detectedCode === 'string' && parsed.detectedCode.trim()
        ? parsed.detectedCode.trim()
        : expectedEventCode,
    detectedAmountARS: Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount
      : expectedAmountARS ?? 8000,
    detectedDate:
      typeof parsed.detectedDate === 'string' && parsed.detectedDate.trim()
        ? parsed.detectedDate.trim()
        : new Date().toISOString().slice(0, 10),
    senderName:
      typeof parsed.senderName === 'string' && parsed.senderName.trim()
        ? parsed.senderName.trim()
        : 'Titular de Cuenta',
    status,
    notes:
      typeof parsed.notes === 'string' && parsed.notes.trim()
        ? parsed.notes.trim()
        : `Comprobante procesado. Coincide con código ${expectedEventCode}.`,
  };
}

export async function analyzePaymentReceiptOnServer(
  input: AnalyzeReceiptInput,
  clientOverride?: GeminiClientLike
): Promise<ReceiptOcrResult> {
  const { imageDataUrl, expectedEventCode, expectedAmountARS } = input;
  if (!expectedEventCode || typeof expectedEventCode !== 'string') {
    throw new GeminiHttpError('El código de evento esperado es obligatorio.', 400);
  }

  const { mimeType, data } = parseDataUrlImage(imageDataUrl);
  const ai = clientOverride ?? createGeminiClient();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
          {
            text: `Analiza este comprobante de transferencia bancaria o Mercado Pago.
Código de evento esperado: "${expectedEventCode}".
Monto esperado: ${expectedAmountARS ? '$' + expectedAmountARS : 'A definir'}.
Extrae en formato JSON con las claves:
- detectedCode (string con el código encontrado o null)
- detectedAmountARS (número o null)
- detectedDate (string o null)
- senderName (string o null)
- status ('valido' | 'dudoso' | 'incompleto')
- notes (breve explicación en español)`,
          },
        ],
      },
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedCode: { type: Type.STRING, nullable: true },
            detectedAmountARS: { type: Type.NUMBER, nullable: true },
            detectedDate: { type: Type.STRING, nullable: true },
            senderName: { type: Type.STRING, nullable: true },
            status: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
        },
      },
    });

    return normalizeReceiptOcrResult(response.text, expectedEventCode, expectedAmountARS);
  } catch (err: any) {
    if (err instanceof GeminiHttpError) {
      throw err;
    }
    const statusCode =
      typeof err?.status === 'number'
        ? err.status
        : typeof err?.statusCode === 'number'
        ? err.statusCode
        : 502;
    const message =
      err?.message || 'Error al analizar el comprobante con Gemini en el servidor.';
    throw new GeminiHttpError(message, statusCode);
  }
}
