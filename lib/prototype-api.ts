import type { UniversityAuthenticatedUser } from "@/lib/auth";

export const privateNoStore = { "Cache-Control": "private, no-store" };
export const maxJsonBodyBytes = 64 * 1024;

export function apiJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: privateNoStore });
}

export type JsonBodyResult =
  | { body: Record<string, unknown>; response?: never }
  | { body?: never; response: Response };

export async function readJsonObject(request: Request): Promise<JsonBodyResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxJsonBodyBytes) {
    return { response: apiJson({ success: false, message: "Request body is too large." }, 413) };
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxJsonBodyBytes) {
      return { response: apiJson({ success: false, message: "Request body is too large." }, 413) };
    }
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { response: apiJson({ success: false, message: "Request body must be a JSON object." }, 400) };
    }
    return { body: value as Record<string, unknown> };
  } catch {
    return { response: apiJson({ success: false, message: "Request body must contain valid JSON." }, 400) };
  }
}

export function rejectUnexpectedFields(
  body: Record<string, unknown>,
  allowed: readonly string[]
): Response | null {
  const allow = new Set(allowed);
  const unexpected = Object.keys(body).filter((key) => !allow.has(key));
  return unexpected.length
    ? apiJson({ success: false, message: "Request contains unsupported fields.", errors: unexpected }, 400)
    : null;
}

export function parsePage(url: string, defaultLimit = 20, maxLimit = 50) {
  const params = new URL(url).searchParams;
  const rawPage = params.get("page") ?? "1";
  const rawLimit = params.get("limit") ?? String(defaultLimit);
  if (!/^\d+$/.test(rawPage) || !/^\d+$/.test(rawLimit)) return null;
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit) return null;
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) return null;
  return { page, limit, skip };
}

export function pageInfo(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export function requiredText(body: Record<string, unknown>, field: string, max: number): string | null {
  const value = body[field];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

export function optionalText(body: Record<string, unknown>, field: string, max: number): string | null | undefined {
  if (body[field] === undefined) return undefined;
  if (body[field] === null || body[field] === "") return null;
  if (typeof body[field] !== "string") return undefined;
  const normalized = body[field].trim();
  return normalized.length <= max ? normalized : undefined;
}

export function isUniversityPeer(user: UniversityAuthenticatedUser, universityId: string | null): boolean {
  return universityId === user.universityId;
}

export function hasSecondaryRole(user: UniversityAuthenticatedUser, role: string): boolean {
  return user.secondaryRoles.some((item) => item.role === role);
}

export function isUniversityModerator(user: UniversityAuthenticatedUser): boolean {
  return hasSecondaryRole(user, "ADMINISTRATOR") || hasSecondaryRole(user, "PROCTOR");
}
