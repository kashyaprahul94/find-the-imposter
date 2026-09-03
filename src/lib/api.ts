import type { ConcludedRound, RoundView } from "./types";

async function call<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const api = {
  createRoom: () => call<{ code: string }>("/api/rooms", { method: "POST" }),

  roomExists: async (code: string) => {
    try {
      await call<{ code: string }>(`/api/rooms/${code}`);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return false;
      throw err;
    }
  },

  join: (code: string, name: string, token: string | null) =>
    call<{ playerKey: string; name: string; token: string }>(
      `/api/rooms/${code}/join`,
      { method: "POST", body: JSON.stringify({ name, token }) },
    ),

  state: (code: string, token: string) =>
    call<{ round: RoundView | null }>(`/api/rooms/${code}/state`, { token }),

  deal: (
    code: string,
    token: string,
    body: { othersWord: string; imposterWord: string; participantKeys: string[] },
  ) =>
    call<{ roundKey: string }>(`/api/rooms/${code}/rounds`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),

  reveal: (code: string, token: string, roundKey: string) =>
    call<{ imposterName: string }>(
      `/api/rooms/${code}/rounds/${roundKey}/reveal`,
      { method: "POST", token },
    ),

  clear: (code: string, token: string, roundKey: string) =>
    call<{ ok: true }>(`/api/rooms/${code}/rounds/${roundKey}/clear`, {
      method: "POST",
      token,
    }),

  history: (code: string, token: string) =>
    call<{ history: ConcludedRound[] }>(`/api/rooms/${code}/history`, { token }),
};
