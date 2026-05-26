/**
 * Service de gestion des chauffeurs et controle qualite.
 * Stockage local JSON pour le mapping chauffeur <-> utilisateur 3CX.
 * Aggregation des communications, enregistrements et historique par chauffeur.
 */

const fs = require('fs');
const path = require('path');
const { normalizeCallRecord: normalizeReportCallRecord } = require('./CallHistory');

const DEFAULT_STORE_PATH = path.join(process.cwd(), 'data', 'drivers.json');

// ─── Stockage local ────────────────────────────────────────────

function ensureStore(storePath) {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(storePath)) {
        fs.writeFileSync(storePath, JSON.stringify({ drivers: [] }, null, 2), 'utf-8');
    }
}

function readStore(storePath) {
    ensureStore(storePath);
    return JSON.parse(fs.readFileSync(storePath, 'utf-8'));
}

function writeStore(storePath, data) {
    ensureStore(storePath);
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Auto-detection des chauffeurs depuis les extensions ───────

/**
 * Detecter les extensions dont le nom commence par "chauffeur" (insensible a la casse).
 * Retourne des objets Driver avec source='auto'.
 */
function detectDriversFromExtensions(extensions) {
    return extensions
        .filter(ext => ext.name && ext.name.toLowerCase().startsWith('chauffeur'))
        .map(ext => ({
            id: `AUTO-${ext.number}`,
            name: ext.name,
            phone: null,
            extension: ext.number,
            threecxUserId: ext.id || null,
            email: ext.email || null,
            active: true,
            source: 'auto',
            createdAt: null,
            updatedAt: null,
        }));
}

/**
 * Fusionner les chauffeurs auto-detectes et manuels.
 * Les manuels ont priorite si meme extension.
 */
function mergeDrivers(autoDrivers, manualDrivers) {
    const manualExtensions = new Set(manualDrivers.map(d => d.extension));
    const filtered = autoDrivers.filter(d => !manualExtensions.has(d.extension));
    return [
        ...filtered,
        ...manualDrivers.map(d => ({ ...d, source: d.source || 'manual' })),
    ];
}

// ─── CRUD Chauffeurs ───────────────────────────────────────────

/**
 * Liste les chauffeurs manuels uniquement (sans extensions).
 */
function listManualDrivers(storePath = DEFAULT_STORE_PATH) {
    const store = readStore(storePath);
    return (store.drivers || []).map(d => ({ ...d, source: 'manual' }));
}

/**
 * Liste les chauffeurs : auto-detectes depuis extensions + manuels.
 * Necessite le client HTTP pour appeler getExtensions.
 */
async function listDrivers(http, storePath = DEFAULT_STORE_PATH) {
    const { getExtensions } = require('./System');
    let extensions = [];
    try {
        extensions = await getExtensions(http);
    } catch {
        // Si les extensions ne sont pas accessibles, on continue avec les manuels
    }
    const autoDrivers = detectDriversFromExtensions(extensions);
    const manualDrivers = listManualDrivers(storePath);
    return mergeDrivers(autoDrivers, manualDrivers);
}

/**
 * Retrouver un chauffeur par ID (auto ou manuel).
 */
async function getDriver(http, driverId, storePath = DEFAULT_STORE_PATH) {
    const all = await listDrivers(http, storePath);
    return all.find(d => d.id === driverId) || null;
}

/**
 * Retrouver un chauffeur par telephone ou extension (auto ou manuel).
 */
async function getDriverByPhone(http, phone, storePath = DEFAULT_STORE_PATH) {
    const all = await listDrivers(http, storePath);
    return all.find(d => d.phone === phone || d.extension === phone) || null;
}

function createDriver(driverData, storePath = DEFAULT_STORE_PATH) {
    const store = readStore(storePath);
    const drivers = store.drivers || [];

    const newDriver = {
        id: driverData.id || `DRV-${Date.now()}`,
        name: driverData.name,
        phone: driverData.phone || null,
        extension: driverData.extension,
        threecxUserId: driverData.threecxUserId || null,
        email: driverData.email || null,
        active: driverData.active !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    // Verifier unicite extension
    if (drivers.some(d => d.extension === newDriver.extension)) {
        throw new Error(`Un chauffeur avec l'extension ${newDriver.extension} existe deja.`);
    }

    drivers.push(newDriver);
    store.drivers = drivers;
    writeStore(storePath, store);
    return newDriver;
}

function updateDriver(driverId, updates, storePath = DEFAULT_STORE_PATH) {
    const store = readStore(storePath);
    const drivers = store.drivers || [];
    const index = drivers.findIndex(d => d.id === driverId);
    if (index === -1) return null;

    // Verifier unicite extension si modifiee
    if (updates.extension && updates.extension !== drivers[index].extension) {
        if (drivers.some(d => d.extension === updates.extension)) {
            throw new Error(`Un chauffeur avec l'extension ${updates.extension} existe deja.`);
        }
    }

    drivers[index] = {
        ...drivers[index],
        ...updates,
        id: driverId, // Immutable
        updatedAt: new Date().toISOString(),
    };

    store.drivers = drivers;
    writeStore(storePath, store);
    return drivers[index];
}

function deleteDriver(driverId, storePath = DEFAULT_STORE_PATH) {
    const store = readStore(storePath);
    const drivers = store.drivers || [];
    const index = drivers.findIndex(d => d.id === driverId);
    if (index === -1) return false;

    drivers.splice(index, 1);
    store.drivers = drivers;
    writeStore(storePath, store);
    return true;
}

// ─── Communications d'un chauffeur ─────────────────────────────

/**
 * Recuperer le dossier complet d'un chauffeur :
 * - Infos du chauffeur
 * - Dernieres communications (appels)
 * - Enregistrements
 * - Transcriptions
 */
async function getDriverDossier(http, driverId, options = {}, storePath = DEFAULT_STORE_PATH) {
    const driver = await getDriver(http, driverId, storePath);
    if (!driver) throw new Error(`Chauffeur ${driverId} introuvable.`);

    const ext = driver.extension;
    const limit = options.limit || 20;
    const startDate = options.startDate;
    const endDate = options.endDate;

    // Recuperer appels, enregistrements en parallele
    const [callsOut, callsIn, recordings] = await Promise.all([
        fetchCallHistory(http, { caller: ext, startDate, endDate, pageSize: limit }),
        fetchCallHistory(http, { callee: ext, startDate, endDate, pageSize: limit }),
        fetchRecordings(http, { extension: ext, startDate, endDate, pageSize: limit }),
    ]);

    // Fusionner et trier les appels par date
    const allCalls = [...callsOut, ...callsIn]
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(0, limit);

    // Deduplication par ID
    const seen = new Set();
    const uniqueCalls = allCalls.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
    });

    return {
        driver,
        calls: uniqueCalls,
        recordings: recordings,
        totalCalls: uniqueCalls.length,
        totalRecordings: recordings.length,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Recuperer les communications d'un chauffeur par son numero de telephone.
 */
async function getDriverCommunicationsByPhone(http, phone, options = {}, storePath = DEFAULT_STORE_PATH) {
    const driver = await getDriverByPhone(http, phone, storePath);
    if (!driver) throw new Error(`Aucun chauffeur trouve avec le numero ${phone}.`);
    return getDriverDossier(http, driver.id, options, storePath);
}

/**
 * Recuperer les dernieres communications sur une duree en minutes.
 */
async function getDriverRecentCommunications(http, driverId, minutes = 60, storePath = DEFAULT_STORE_PATH) {
    const now = new Date();
    const from = new Date(now.getTime() - minutes * 60 * 1000);

    return getDriverDossier(http, driverId, {
        startDate: from.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        limit: 100,
    }, storePath);
}

// ─── Helpers internes ──────────────────────────────────────────

function buildGetCallLogPath(options = {}) {
    const now = new Date();

    let periodFrom, periodTo;
    if (options.startDate) {
        periodFrom = options.startDate.includes('T')
            ? options.startDate
            : `${options.startDate}T00:00:00Z`;
    } else {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        periodFrom = `${d.toISOString().split('T')[0]}T00:00:00Z`;
    }
    if (options.endDate) {
        periodTo = options.endDate.includes('T')
            ? options.endDate
            : `${options.endDate}T23:59:59Z`;
    } else {
        periodTo = now.toISOString();
    }

    const sourceFilter = options.caller || '';
    const destinationFilter = options.callee || '';

    return `/xapi/v1/ReportCallLogData/Pbx.GetCallLogData(`
        + `periodFrom=${periodFrom}`
        + `,periodTo=${periodTo}`
        + `,sourceType=0`
        + `,sourceFilter='${sourceFilter}'`
        + `,destinationType=0`
        + `,destinationFilter='${destinationFilter}'`
        + `,callsType=0`
        + `,callTimeFilterType=0`
        + `,callTimeFilterFrom='0:00:0'`
        + `,callTimeFilterTo='0:00:0'`
        + `,hidePcalls=true`
        + `)`;
}

function normalizeCallRecord(raw) {
    return {
        id: raw.Id?.toString() || raw.SegmentId?.toString() || '',
        caller: raw.SourceCallerNumber || raw.SrcCallerNumber || raw.SourceDisplayName || '',
        callerName: raw.SourceDisplayName || raw.SrcDisplayName || '',
        callee: raw.DestinationCallerNumber || raw.DstCallerNumber || raw.DestinationDisplayName || '',
        calleeName: raw.DestinationDisplayName || raw.DstDisplayName || '',
        startTime: raw.StartTime || raw.SegmentStartTime || '',
        endTime: raw.EndTime || raw.SegmentEndTime || '',
        duration: parseDuration(raw.TalkingTime || raw.CallTime),
        status: raw.IsAnswered ?? raw.CallAnswered ? 'answered' : 'missed',
        srcDn: raw.SourceDn || raw.SrcDn || '',
        dstDn: raw.DestinationDn || raw.DstDn || '',
        recordingId: raw.RecordingUrl || raw.DstRecId || null,
    };
}

function parseDuration(iso) {
    if (!iso) return 0;
    if (typeof iso === 'number') return iso;
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] || 0) * 3600) +
           (parseInt(match[2] || 0) * 60) +
           Math.round(parseFloat(match[3] || 0));
}

async function fetchCallHistory(http, options = {}) {
    const path = buildGetCallLogPath(options);
    const params = {
        $top: options.pageSize || 50,
        $skip: 0,
        $orderby: 'StartTime desc',
    };

    try {
        const { data } = await http.get(path, { params, timeout: 60000 });
        return (data.value || []).map(normalizeReportCallRecord);
    } catch {
        return [];
    }
}

function normalizeRecording(raw) {
    return {
        id: raw.Id?.toString() || '',
        startTime: raw.StartTime || '',
        endTime: raw.EndTime || '',
        caller: raw.FromCallerNumber || raw.FromDisplayName || '',
        callerName: raw.FromDisplayName || '',
        callee: raw.ToCallerNumber || raw.ToDisplayName || '',
        calleeName: raw.ToDisplayName || '',
        isTranscribed: raw.IsTranscribed ?? false,
        transcription: raw.Transcription || '',
        summary: raw.Summary || '',
        sentimentScore: raw.SentimentScore ?? 0,
    };
}

async function fetchRecordings(http, options = {}) {
    const params = {
        $top: options.pageSize || 50,
        $skip: 0,
        $orderby: 'StartTime desc',
        $count: true,
    };

    const filters = [];
    if (options.startDate) {
        const d = options.startDate.includes('T') ? options.startDate : `${options.startDate}T00:00:00Z`;
        filters.push(`StartTime ge ${d}`);
    }
    if (options.endDate) {
        const d = options.endDate.includes('T') ? options.endDate : `${options.endDate}T23:59:59Z`;
        filters.push(`StartTime le ${d}`);
    }
    // Filtrer par extension du chauffeur (caller ou callee)
    if (options.extension) {
        filters.push(`(contains(FromCallerNumber,'${options.extension}') or contains(ToCallerNumber,'${options.extension}'))`);
    }
    if (filters.length) {
        params.$filter = filters.join(' and ');
    }

    try {
        const { data } = await http.get('/xapi/v1/Recordings', { params });
        return (data.value || []).map(normalizeRecording);
    } catch {
        return [];
    }
}

module.exports = {
    listDrivers,
    getDriver,
    getDriverByPhone,
    createDriver,
    updateDriver,
    deleteDriver,
    getDriverDossier,
    getDriverCommunicationsByPhone,
    getDriverRecentCommunications,
};
