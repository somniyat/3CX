import type { AxiosInstance } from "axios";

const REFRESH_MARGIN_MS = 5 * 1000;

export async function authenticate(
  http: AxiosInstance,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const { data } = await http.post("/connect/token", body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    _skipAuth: true,
  } as any);

  if (!data || !data.access_token) {
    throw new Error("Echec authentification 3CX : aucun access_token recu.");
  }

  const expiresInMs = (data.expires_in || 60) * 1000;
  const expiresAt = Date.now() + expiresInMs - REFRESH_MARGIN_MS;

  return { accessToken: data.access_token, expiresAt };
}

export function isTokenExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return true;
  return Date.now() >= expiresAt;
}
