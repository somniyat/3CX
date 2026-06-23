import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

interface AxiosConfigWithSkipAuth extends InternalAxiosRequestConfig {
  _skipAuth?: boolean;
}

export function createHttpClient(
  baseURL: string,
  timeout: number,
  getToken: () => string | null,
  refreshToken: () => Promise<void>,
): AxiosInstance {
  let refreshPromise: Promise<void> | null = null;

  const instance = axios.create({
    baseURL,
    timeout,
    headers: { "Content-Type": "application/json" },
  });

  instance.interceptors.request.use(async (config: AxiosConfigWithSkipAuth) => {
    if (config._skipAuth) return config;

    let token = getToken();
    if (!token) {
      if (!refreshPromise) {
        refreshPromise = refreshToken().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      token = getToken();
    }

    config.headers["Authorization"] = `Bearer ${token}`;
    return config;
  });

  return instance;
}
