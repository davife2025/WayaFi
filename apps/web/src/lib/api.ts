const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

let authToken: string | null = null;
export const setAuthToken = (t: string) => { authToken = t; };

async function request(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const apiClient = {
  get:    (path: string)              => request("GET",    path),
  post:   (path: string, body: any)  => request("POST",   path, body),
  delete: (path: string)             => request("DELETE", path),
};
