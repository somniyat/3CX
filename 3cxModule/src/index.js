const { createHttpClient } = require('./utils/http');
const { authenticate, isTokenExpired } = require('./services/Auth');
const { getCallHistory, getAllCallHistory } = require('./services/CallHistory');
const { getRecordings, downloadRecording } = require('./services/Recordings');
const { getTranscription, getTranscriptions } = require('./services/Transcriptions');
const { getExtensions, getSystemStatus, getActiveCalls, listUsers } = require('./services/System');
const {
    listDrivers, getDriver, getDriverByPhone,
    createDriver, updateDriver, deleteDriver,
    getDriverDossier, getDriverCommunicationsByPhone, getDriverRecentCommunications,
} = require('./services/Drivers');

class ThreeCXModule {
    #http;
    #clientId;
    #clientSecret;
    #token;
    #tokenExpiresAt;

    /**
     * Initialiser le module avec les credentials API 3CX (OAuth2).
     *
     * @param {Object} [config]
     * @param {string} [config.baseUrl] - URL du serveur 3CX (ex: https://duperrex.3cx.ch:5001)
     * @param {string} [config.clientId] - Client ID de l'API 3CX
     * @param {string} [config.clientSecret] - Client Secret de l'API 3CX
     * @param {number} [config.timeout=15000] - Timeout des requetes en ms
     * @returns {ThreeCXModule}
     */
    init({ baseUrl, clientId, clientSecret, timeout } = {}) {
        const resolvedUrl = baseUrl ?? process.env.THREECX_BASE_URL;
        const resolvedId = clientId ?? process.env.THREECX_CLIENT_ID;
        const resolvedSecret = clientSecret ?? process.env.THREECX_CLIENT_SECRET;
        const resolvedTimeout = timeout ?? 15000;

        if (!resolvedUrl) throw new Error("baseUrl est requis. Fournir via init() ou THREECX_BASE_URL.");
        if (!resolvedId) throw new Error("clientId est requis. Fournir via init() ou THREECX_CLIENT_ID.");
        if (!resolvedSecret) throw new Error("clientSecret est requis. Fournir via init() ou THREECX_CLIENT_SECRET.");

        this.#clientId = resolvedId;
        this.#clientSecret = resolvedSecret;
        this.#token = null;
        this.#tokenExpiresAt = null;

        this.#http = createHttpClient(
            resolvedUrl.replace(/\/+$/, ''),
            resolvedTimeout,
            () => (this.#token && !isTokenExpired(this.#tokenExpiresAt)) ? this.#token : null,
            () => this.#refreshToken()
        );

        return this;
    }

    async #refreshToken() {
        if (this.#token && !isTokenExpired(this.#tokenExpiresAt)) return;

        const result = await authenticate(this.#http, this.#clientId, this.#clientSecret);
        this.#token = result.accessToken;
        this.#tokenExpiresAt = result.expiresAt;
    }

    #ensureInitialized() {
        if (!this.#http) throw new Error("ThreeCXModule non initialise. Appeler init() d'abord.");
    }

    // ─── Historique des appels ───────────────────────────────────

    async getCallHistory(options) {
        this.#ensureInitialized();
        return getCallHistory(this.#http, options);
    }

    async getAllCallHistory(options) {
        this.#ensureInitialized();
        return getAllCallHistory(this.#http, options);
    }

    // ─── Enregistrements ─────────────────────────────────────────

    async getRecordings(options) {
        this.#ensureInitialized();
        return getRecordings(this.#http, options);
    }

    async downloadRecording(recordingId) {
        this.#ensureInitialized();
        return downloadRecording(this.#http, recordingId);
    }

    // ─── Transcriptions ───────────────────────────────────────────

    async getTranscription(recordingId) {
        this.#ensureInitialized();
        return getTranscription(this.#http, recordingId);
    }

    async getTranscriptions(options) {
        this.#ensureInitialized();
        return getTranscriptions(this.#http, options);
    }

    // ─── Systeme & Extensions ────────────────────────────────────

    async getExtensions() {
        this.#ensureInitialized();
        return getExtensions(this.#http);
    }

    async getSystemStatus() {
        this.#ensureInitialized();
        return getSystemStatus(this.#http);
    }

    async getActiveCalls() {
        this.#ensureInitialized();
        return getActiveCalls(this.#http);
    }

    // ─── Utilisateurs ──────────────────────────────────────────

    async listUsers(options) {
        this.#ensureInitialized();
        return listUsers(this.#http, options);
    }

    // ─── Chauffeurs (Controle Qualite) ─────────────────────────

    async listDrivers() {
        this.#ensureInitialized();
        return listDrivers(this.#http);
    }

    async getDriver(driverId) {
        this.#ensureInitialized();
        return getDriver(this.#http, driverId);
    }

    async getDriverByPhone(phone) {
        this.#ensureInitialized();
        return getDriverByPhone(this.#http, phone);
    }

    createDriver(driverData) {
        return createDriver(driverData);
    }

    updateDriver(driverId, updates) {
        return updateDriver(driverId, updates);
    }

    deleteDriver(driverId) {
        return deleteDriver(driverId);
    }

    async getDriverDossier(driverId, options) {
        this.#ensureInitialized();
        return getDriverDossier(this.#http, driverId, options);
    }

    async getDriverCommunicationsByPhone(phone, options) {
        this.#ensureInitialized();
        return getDriverCommunicationsByPhone(this.#http, phone, options);
    }

    async getDriverRecentCommunications(driverId, minutes) {
        this.#ensureInitialized();
        return getDriverRecentCommunications(this.#http, driverId, minutes);
    }

    // ─── Diagnostic ────────────────────────────────────────────

    async runAccessAudit() {
        this.#ensureInitialized();

        // Ensure we have a valid token
        await this.#refreshToken();

        // Decode JWT payload (no signature verification needed)
        const tokenInfo = this.#decodeTokenInfo(this.#token);

        const ENDPOINTS_TO_PROBE = [
            { path: 'Defs?$select=Id',          desc: 'Quick Test (validation auth)',        critical: false },
            { path: 'Users?$top=1',             desc: 'Liste extensions/utilisateurs',       critical: true  },
            { path: 'Groups?$top=1',            desc: 'Liste des groupes',                   critical: false },
            { path: 'Departments?$top=1',       desc: 'Liste des départements',              critical: false },
            { path: 'Trunks?$top=1',            desc: 'Liste des trunks SIP',                critical: false },
            { path: 'SystemStatus',             desc: 'Statut système (licence, version)',   critical: true  },
            { path: 'ActiveCalls',              desc: 'Appels actifs en temps réel',         critical: true  },
            { path: `ReportCallLogData/Pbx.GetCallLogData(periodFrom=${new Date(Date.now() - 86400000).toISOString()},periodTo=${new Date().toISOString()},sourceType=0,sourceFilter='',destinationType=0,destinationFilter='',callsType=0,callTimeFilterType=0,callTimeFilterFrom='0:00:0',callTimeFilterTo='0:00:0',hidePcalls=true)?$top=1`, desc: "Historique d'appels (GetCallLogData)", critical: true },
            { path: 'Recordings?$top=1',        desc: 'Enregistrements audio',               critical: true  },
            { path: 'Recordings?$filter=IsTranscribed eq true&$top=1', desc: 'Transcriptions', critical: true },
        ];

        const audit = [];

        // Sequential probing to avoid saturating the PBX
        for (const ep of ENDPOINTS_TO_PROBE) {
            const start = Date.now();
            let httpCode = 0;
            let errorBody = null;

            try {
                const res = await this.#http.get(`/xapi/v1/${ep.path}`);
                httpCode = res.status || 200;
            } catch (err) {
                if (err.response) {
                    httpCode = err.response.status;
                    try {
                        const body = typeof err.response.data === 'string'
                            ? err.response.data
                            : JSON.stringify(err.response.data);
                        errorBody = body.length > 200 ? body.slice(0, 200) : body;
                    } catch {
                        errorBody = err.message?.slice(0, 200) || 'Unknown error';
                    }
                } else {
                    errorBody = err.message?.slice(0, 200) || 'Network error';
                }
            }

            audit.push({
                endpoint: ep.path,
                description: ep.desc,
                critical: ep.critical,
                httpCode,
                accessible: httpCode === 200,
                responseTimeMs: Date.now() - start,
                errorBody,
            });
        }

        const summary = {
            total: audit.length,
            accessible: audit.filter(a => a.accessible).length,
            forbidden: audit.filter(a => a.httpCode === 403).length,
            badRequest: audit.filter(a => a.httpCode === 400).length,
            other: audit.filter(a => !a.accessible && a.httpCode !== 403 && a.httpCode !== 400).length,
        };

        return {
            tokenInfo,
            audit,
            summary,
            generatedAt: new Date().toISOString(),
        };
    }

    #decodeTokenInfo(token) {
        try {
            const parts = token.split('.');
            if (parts.length < 2) return this.#fallbackTokenInfo();

            // Handle both standard base64 and base64url
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

            const roleClaim = payload.role || payload.roles || [];
            const roleClaims = Array.isArray(roleClaim) ? roleClaim : [roleClaim];

            return {
                clientId: payload.unique_name || payload.client_id || payload.sub || this.#clientId,
                maxRole: payload.MaxRole || payload.maxrole || 'unknown',
                roleClaims,
                issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'unknown',
                expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'unknown',
                issuer: payload.iss || 'unknown',
            };
        } catch {
            return this.#fallbackTokenInfo();
        }
    }

    #fallbackTokenInfo() {
        return {
            clientId: this.#clientId,
            maxRole: 'unknown',
            roleClaims: [],
            issuedAt: 'unknown',
            expiresAt: 'unknown',
            issuer: 'unknown',
        };
    }
}

module.exports = new ThreeCXModule();
