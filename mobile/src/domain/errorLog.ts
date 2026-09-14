/**
 * Shapes a caught error into the record the error boundary stores and later
 * uploads to POST /logs. Pure, so the boundary's behaviour is testable.
 */

export interface ErrorRecord {
  action: string;
  message: string;
  stack: string | null;
  occurredAt: number;
}

const MAX_MESSAGE = 1000;
const MAX_STACK = 8000;

/** "Route · what the farmer was doing", e.g. "FertilizerCalculator · Tính lượng cần". */
export function describeAction(route: string, detail?: string | null): string {
  return detail ? `${route} · ${detail}` : route;
}

export function toErrorRecord(error: unknown, route: string, detail: string | null, occurredAt: number): ErrorRecord {
  let message: string;
  let stack: string | null = null;
  if (error instanceof Error) {
    message = error.message || error.name || 'Lỗi không rõ';
    stack = error.stack ?? null;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }
  return {
    action: describeAction(route, detail),
    message: message.slice(0, MAX_MESSAGE),
    stack: stack ? stack.slice(0, MAX_STACK) : null,
    occurredAt,
  };
}

/** Farmer-facing detail line: the message, never the stack. */
export function friendlyDetail(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return 'Không có thông tin thêm.';
  return trimmed.length > 200 ? `${trimmed.slice(0, 199)}…` : trimmed;
}
