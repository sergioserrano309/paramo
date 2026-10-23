/** IP del cliente para rate limiting (primer hop de x-forwarded-for). */
export function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

type JsonBody = { ok: true; json: unknown } | { ok: false; status: 413 | 422 };

/** Lee el body con tope de tamaño (AGENTS §4: límite de body en cada endpoint). */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<JsonBody> {
  const raw = await request.text();
  if (raw.length > maxBytes) return { ok: false, status: 413 };
  try {
    return { ok: true, json: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 422 };
  }
}
