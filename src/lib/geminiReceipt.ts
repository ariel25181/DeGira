/**
 * DeGira - Cliente para validación multimodal de comprobantes de pago.
 * Invoca el endpoint del servidor (/api/gemini/analyze-receipt) para
 * procesar el comprobante de forma centralizada.
 */

export interface ReceiptOcrResult {
  detectedCode: string | null;
  detectedAmountARS: number | null;
  detectedDate: string | null;
  senderName: string | null;
  status: 'valido' | 'dudoso' | 'incompleto';
  notes: string;
}

/**
 * Envía un comprobante de pago en imagen (base64 o data URL) al servidor
 * para extraer código de evento, monto, fecha y estado de la transferencia.
 */
export async function analyzePaymentReceipt(
  imageDataUrl: string,
  expectedEventCode: string,
  expectedAmountARS?: number
): Promise<ReceiptOcrResult> {
  const response = await fetch('/api/gemini/analyze-receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageDataUrl,
      expectedEventCode,
      expectedAmountARS,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      typeof payload?.error === 'string' && payload.error
        ? payload.error
        : `Error ${response.status} al analizar el comprobante en el servidor.`;
    throw new Error(errorMessage);
  }

  return payload as ReceiptOcrResult;
}
