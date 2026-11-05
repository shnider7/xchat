export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/p/${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  if (res.status === 401) { window.location.href = "/login"; throw new Error("sessão expirada"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? data.message ?? `erro ${res.status}`);
  return data;
}
export const getRole = () => document.cookie.match(/(?:^|; )role=([^;]*)/)?.[1] ?? "";
