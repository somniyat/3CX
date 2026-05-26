/**
 * Service d'authentification OAuth2 aupres de l'API 3CX.
 * Utilise le grant_type client_credentials via /connect/token.
 */

const REFRESH_MARGIN_MS = 5 * 1000; // Rafraichir 5s avant expiration

/**
 * Obtenir un access token via OAuth2 client_credentials.
 *
 * @param {import('axios').AxiosInstance} http
 * @param {string} clientId
 * @param {string} clientSecret
 * @returns {Promise<{accessToken: string, expiresAt: number}>}
 */
async function authenticate(http, clientId, clientSecret) {
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    });

    const { data } = await http.post('/connect/token', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        _skipAuth: true,
    });

    if (!data || !data.access_token) {
        throw new Error('Echec authentification 3CX : aucun access_token recu.');
    }

    const expiresInMs = (data.expires_in || 60) * 1000;
    const expiresAt = Date.now() + expiresInMs - REFRESH_MARGIN_MS;

    return { accessToken: data.access_token, expiresAt };
}

function isTokenExpired(expiresAt) {
    if (!expiresAt) return true;
    return Date.now() >= expiresAt;
}

module.exports = { authenticate, isTokenExpired };
