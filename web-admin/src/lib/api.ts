/**
 * Thin client for the FastAPI backend, browser side.
 *
 * The JWT lives in localStorage under one key; every call sends it as a
 * Bearer header. A 401 clears it so the caller can send the user to /login.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const TOKEN_KEY = "agrilog.token";

export interface SessionUser {
  id: string;
  username: string;
  full_name: string;
  role: "farmer" | "admin";
  region: string | null;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the session simply does not survive a reload.
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    setToken(null);
    throw new ApiError("Phiên đăng nhập đã hết hạn", 401);
  }
  if (!res.ok) {
    let detail = `Lỗi máy chủ (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // keep the generic message
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetches a binary endpoint (the PDF) and returns it as a Blob. */
export async function apiBlob(path: string): Promise<{blob: Blob; filename: string}> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {headers: token ? {Authorization: `Bearer ${token}`} : {}});
  if (res.status === 401) {
    setToken(null);
    throw new ApiError("Phiên đăng nhập đã hết hạn", 401);
  }
  if (!res.ok) {
    let detail = `Lỗi máy chủ (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // keep the generic message
    }
    throw new ApiError(detail, res.status);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  return {blob: await res.blob(), filename: match?.[1] ?? "bao-cao.pdf"};
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const body = await api<{access_token: string; user: SessionUser}>("/auth/login", {
    method: "POST",
    body: JSON.stringify({username, password}),
  });
  setToken(body.access_token);
  return body.user;
}

export const formatVnd = (value: number): string =>
  `${new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 0}).format(value)}₫`;

export const formatKg = (value: number): string =>
  `${new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 2}).format(value)} kg`;
