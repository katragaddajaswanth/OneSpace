type ErrorWithMetadata = Error & { code?: unknown };

export type DevelopmentApiDiagnostic = {
  endpoint: string;
  stage: string;
  errorName: string;
  errorCode?: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_./ -]{1,80}$/.test(value)) {
    return fallback;
  }
  return value;
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/\b(?:SELECT\b[\s\S]*|INSERT\s+INTO\b[\s\S]*|UPDATE\s+[\w."`]+\s+SET\b[\s\S]*|DELETE\s+FROM\b[\s\S]*)/gi, "[redacted SQL]")
    .replace(/(?:postgres(?:ql)?|https?|mysql|mongodb(?:\+srv)?|rediss?):\/\/[^\s"'`<>]+/gi, "[redacted-url]")
    .replace(/\bone_space_session=[^;\s]+/gi, "one_space_session=[redacted]")
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:select|insert|update|delete|alter|drop|truncate)\b[\s\S]*\b(?:from|into|table|set)\b[\s\S]*/gi, "[redacted SQL]")
    .replace(/'(?:[^']|'')*'/g, "'[redacted]'")
    .replace(/"(?:[^"]|"")*"/g, '"[redacted]"')
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-token]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[redacted-id]")
    .replace(/\bc[a-z0-9]{20,30}\b/gi, "[redacted-id]")
    .replace(/\b(password|token|secret|cookie|authorization|database_url|connectionstring)\b(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[redacted]")
    .replace(/\b(email|full_?name|institutional_?id|user_?id|student_?id|university_?id)\b(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[redacted]")
    .replace(/Key\s*\([^)]*\)\s*=\s*\([^)]*\)/gi, "Key ([redacted])=([redacted])")
    .replace(/(?<!\w)\+?\d[\d().\s-]{8,}\d(?!\w)/g, "[redacted-number]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted-address]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 600);
}

/** Logs a structured diagnostic and returns details only to development callers. */
export function logServerError(
  endpoint: string,
  error: unknown,
  stage = "unknown"
): DevelopmentApiDiagnostic | undefined {
  const source = isRecord(error) ? error as unknown as ErrorWithMetadata : null;
  const details: Record<string, string> = {
    event: "api_request_failed",
    endpoint: safeLabel(endpoint, "unknown_endpoint"),
    stage: safeLabel(stage, "unknown_stage"),
    errorName: safeLabel(source?.name, "UnknownError"),
  };

  if (source && typeof source.code === "string") {
    details.errorCode = safeLabel(source.code, "UNKNOWN_CODE");
  }

  if (process.env.NODE_ENV === "development") {
    const message = source && typeof source.message === "string" ? source.message : "Non-Error value thrown.";
    details.message = sanitizeMessage(message);
  }

  console.error(JSON.stringify(details));

  if (process.env.NODE_ENV !== "development") return undefined;
  return {
    endpoint: details.endpoint,
    stage: details.stage,
    errorName: details.errorName,
    ...(details.errorCode ? { errorCode: details.errorCode } : {}),
    message: details.message,
  };
}

export function serverErrorResponse(
  endpoint: string,
  error: unknown,
  stage: string,
  message: string
): Response {
  const diagnostic = logServerError(endpoint, error, stage);
  return Response.json(
    { success: false, message, ...(diagnostic ? { diagnostic } : {}) },
    { status: 500, headers: { "Cache-Control": "private, no-store" } }
  );
}
