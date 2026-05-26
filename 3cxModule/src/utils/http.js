const axios = require('axios');

/**
 * Cree une instance HTTP configuree pour l'API 3CX
 * avec gestion automatique du token Bearer et mutex sur le refresh.
 */
function createHttpClient(baseURL, timeout, getToken, refreshToken) {
    let refreshPromise = null;

    const instance = axios.create({
        baseURL,
        timeout,
        headers: { 'Content-Type': 'application/json' },
    });

    instance.interceptors.request.use(async (config) => {
        if (config._skipAuth) return config;

        let token = getToken();
        if (!token) {
            // Mutex : une seule requete de refresh a la fois
            if (!refreshPromise) {
                refreshPromise = refreshToken().finally(() => { refreshPromise = null; });
            }
            await refreshPromise;
            token = getToken();
        }

        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
    });

    return instance;
}

module.exports = { createHttpClient };
