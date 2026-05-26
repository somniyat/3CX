/**
 * Service de recuperation de l'historique des appels via XAPI.
 * Endpoint : GET /xapi/v1/ReportCallLogData/Pbx.GetCallLogData(...)
 *
 * Note : CallHistoryView retourne 500 avec des filtres datetime sur
 * certaines instances 3CX. GetCallLogData est l'alternative recommandee.
 */

/**
 * Construire le chemin de l'endpoint GetCallLogData avec les parametres inline.
 */
function buildGetCallLogPath(options = {}) {
    const now = new Date();

    let periodFrom, periodTo;
    if (options.startDate) {
        periodFrom = formatDateTimeBoundary(options.startDate, 'start');
    } else {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        periodFrom = `${d.toISOString().split('T')[0]}T00:00:00Z`;
    }
    if (options.endDate) {
        periodTo = formatDateTimeBoundary(options.endDate, 'end');
    } else {
        periodTo = now.toISOString();
    }

    const sourceFilter = escapeOData(options.caller || '');
    const destinationFilter = escapeOData(options.callee || '');

    const path = `/xapi/v1/ReportCallLogData/Pbx.GetCallLogData(`
        + `periodFrom=${periodFrom}`
        + `,periodTo=${periodTo}`
        + `,sourceType=0`
        + `,sourceFilter='${sourceFilter}'`
        + `,destinationType=0`
        + `,destinationFilter='${destinationFilter}'`
        + `,callsType=0`
        + `,callTimeFilterType=${options.startTime || options.endTime ? 1 : 0}`
        + `,callTimeFilterFrom='${formatCallTime(options.startTime) || '0:00:0'}'`
        + `,callTimeFilterTo='${formatCallTime(options.endTime) || '0:00:0'}'`
        + `,hidePcalls=true`
        + `)`;

    return path;
}

/**
 * Recuperer l'historique des appels avec filtres et pagination.
 */
async function getCallHistory(http, options = {}) {
    const path = buildGetCallLogPath(options);
    const top = options.pageSize || 50;
    const skip = ((options.page || 1) - 1) * top;

    const params = {
        $top: top,
        $skip: skip,
        $orderby: 'StartTime desc',
        $count: true,
    };

    const { data } = await http.get(path, { params, timeout: 60000 });

    // Log le premier enregistrement pour decouvrir les champs disponibles
    if (data.value?.[0] && skip === 0) {
        console.log('[CallHistory] Champs disponibles:', Object.keys(data.value[0]).join(', '));
    }

    const list = (data.value || []).map(normalizeCallRecord);

    return {
        list,
        totalCount: data['@odata.count'] ?? list.length,
    };
}

/**
 * Recuperer tout l'historique avec pagination automatique.
 */
async function getAllCallHistory(http, options = {}) {
    const maxRecords = options.maxRecords || 1000;
    const pageSize = options.pageSize || 100;
    const allRecords = [];
    let page = 1;

    while (allRecords.length < maxRecords) {
        const result = await getCallHistory(http, { ...options, pageSize, page });
        if (!result.list.length) break;

        allRecords.push(...result.list);
        if (allRecords.length >= result.totalCount) break;
        page++;
    }

    return allRecords.slice(0, maxRecords);
}

/**
 * Normaliser un enregistrement XAPI en format interne.
 */
function normalizeCallRecord(raw) {
    const talkingDuration = parseDuration(
        raw.TalkingDuration ?? raw.TalkingTime ?? raw.TalkDuration ?? raw.BillableTime ?? raw.CallTime ?? raw.Duration
    );
    const ringingDuration = parseDuration(raw.RingingDuration ?? raw.RingDuration ?? raw.WaitingDuration);
    const callDuration = parseDuration(raw.CallDuration ?? raw.TotalDuration) || (talkingDuration + ringingDuration);
    const startTime = raw.StartTime || raw.SegmentStartTime || '';
    const endTime = raw.EndTime || raw.SegmentEndTime || addSecondsToDate(startTime, callDuration || talkingDuration);

    return {
        id: raw.Id?.toString() || raw.CallId?.toString() || raw.SegmentId?.toString() || '',
        caller: raw.SourceCallerId || raw.SourceCallerNumber || raw.SrcCallerNumber || raw.SourceDisplayName || '',
        callerName: raw.SourceDisplayName || raw.SrcDisplayName || raw.SourceCallerId || '',
        callee: raw.DestinationCallerId || raw.DestinationCallerNumber || raw.DstCallerNumber || raw.DestinationDisplayName || '',
        calleeName: raw.DestinationDisplayName || raw.DstDisplayName || raw.DestinationCallerId || '',
        startTime,
        endTime,
        duration: talkingDuration || callDuration,
        ringingDuration,
        callDuration: callDuration || talkingDuration,
        status: (raw.Answered ?? raw.IsAnswered ?? raw.CallAnswered) ? 'answered' : 'missed',
        srcDn: raw.SourceDn || raw.SrcDn || '',
        dstDn: raw.DestinationDn || raw.DstDn || '',
        recordingId: raw.DstRecId || raw.SrcRecId || raw.RecordingUrl || null,
        recordingUrl: raw.RecordingUrl || null,
    };
}

/**
 * Parser une duree ISO 8601 / OData (ex: "PT1M30S", "P1DT2H", "00:01:30") en secondes.
 */
function parseDuration(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Math.max(0, Math.round(value));
    if (typeof value === 'object') {
        return parseDuration(value.Duration ?? value.TotalSeconds ?? value.Seconds ?? value.Value);
    }

    const text = String(value).trim();
    if (!text || text === 'P' || text === 'PT') return 0;

    const iso = text.match(/^(-)?P(?:(\d+(?:\.\d+)?)D)?(?:T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
    if (iso) {
        const seconds = (parseFloat(iso[2] || 0) * 86400) +
               (parseFloat(iso[3] || 0) * 3600) +
               (parseFloat(iso[4] || 0) * 60) +
               parseFloat(iso[5] || 0);
        return Math.max(0, Math.round(iso[1] ? -seconds : seconds));
    }

    const time = text.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
    if (time) {
        const days = parseInt(time[1] || 0);
        const hours = parseInt(time[2] || 0);
        const minutes = parseInt(time[3] || 0);
        const seconds = parseInt(time[4] || 0);
        return days * 86400 + hours * 3600 + minutes * 60 + seconds;
    }

    const numeric = Number(text);
    return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function addSecondsToDate(value, seconds) {
    if (!value || !seconds) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() + seconds * 1000).toISOString();
}

function formatDateTimeBoundary(value, boundary) {
    const text = String(value);
    if (text.includes('T')) return text;
    return `${text}${boundary === 'start' ? 'T00:00:00Z' : 'T23:59:59Z'}`;
}

function escapeOData(value) {
    return String(value).replace(/'/g, "''");
}

function formatCallTime(value) {
    if (!value) return '';
    const parts = String(value).split(':');
    if (parts.length < 2) return '';
    return `${Number(parts[0]) || 0}:${String(Number(parts[1]) || 0).padStart(2, '0')}:0`;
}

module.exports = { getCallHistory, getAllCallHistory, normalizeCallRecord, parseDuration };
