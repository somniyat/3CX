/**
 * Service de gestion des enregistrements d'appels via XAPI.
 * Endpoint : GET /xapi/v1/Recordings
 */

/**
 * Lister les enregistrements d'appels.
 */
async function getRecordings(http, options = {}) {
    const params = {
        $top: options.pageSize || 50,
        $skip: Math.max(((options.page || 1) - 1), 0) * (options.pageSize || 50),
        $count: true,
        $orderby: 'StartTime desc',
    };

    const filters = [];
    if (options.startDate) {
        filters.push(`StartTime ge ${formatDateTimeBoundary(options.startDate, 'start')}`);
    }
    if (options.endDate) {
        filters.push(`StartTime le ${formatDateTimeBoundary(options.endDate, 'end')}`);
    }
    if (options.caller) {
        filters.push(`(contains(FromCallerNumber,'${escapeOData(options.caller)}') or contains(FromCallerId,'${escapeOData(options.caller)}') or contains(FromDisplayName,'${escapeOData(options.caller)}'))`);
    }
    if (options.callee) {
        filters.push(`(contains(ToCallerNumber,'${escapeOData(options.callee)}') or contains(ToCallerId,'${escapeOData(options.callee)}') or contains(ToDisplayName,'${escapeOData(options.callee)}'))`);
    }
    if (options.phone) {
        const phone = escapeOData(options.phone);
        filters.push(`(contains(FromCallerNumber,'${phone}') or contains(FromCallerId,'${phone}') or contains(ToCallerNumber,'${phone}') or contains(ToCallerId,'${phone}'))`);
    }
    if (options.transcribed === 'true') filters.push('IsTranscribed eq true');
    if (options.transcribed === 'false') filters.push('IsTranscribed eq false');
    if (filters.length) {
        params.$filter = filters.join(' and ');
    }

    const { data } = await http.get('/xapi/v1/Recordings', { params });

    const list = (data.value || []).map(normalizeRecording);

    return {
        list,
        totalCount: data['@odata.count'] ?? list.length,
    };
}

/**
 * Telecharger un enregistrement (retourne un stream).
 */
async function downloadRecording(http, recordingId) {
    if (!recordingId) throw new Error('recordingId est requis.');

    const { data, headers } = await http.get(
        `/xapi/v1/Recordings/Pbx.DownloadRecording(recId=${recordingId})`,
        { responseType: 'stream' }
    );

    return {
        stream: data,
        contentType: headers['content-type'] || 'audio/wav',
    };
}

function normalizeRecording(raw) {
    const startTime = raw.StartTime || raw.RecordingStartTime || raw.CreatedAt || raw.Date || raw.CreationTime || '';
    const duration = parseDuration(
        raw.Duration ?? raw.RecordingDuration ?? raw.CallDuration ?? raw.TalkingDuration ?? raw.CallTime ?? raw.TalkingTime
    );
    const endTime = raw.EndTime || raw.RecordingEndTime || addSecondsToDate(startTime, duration);

    return {
        id: raw.Id?.toString() || raw.RecordingId?.toString() || raw.RecId?.toString() || '',
        callId: raw.CallId?.toString() || raw.HistoryId?.toString() || '',
        startTime,
        date: startTime,
        endTime,
        caller: raw.FromCallerNumber || raw.FromCallerId || raw.FromDisplayName || raw.SourceCallerId || '',
        callerName: raw.FromDisplayName || raw.SourceDisplayName || raw.FromCallerId || '',
        callee: raw.ToCallerNumber || raw.ToCallerId || raw.ToDisplayName || raw.DestinationCallerId || '',
        calleeName: raw.ToDisplayName || raw.DestinationDisplayName || raw.ToCallerId || '',
        duration,
        isTranscribed: raw.IsTranscribed ?? Boolean(raw.Transcription),
        transcription: raw.Transcription || '',
        summary: raw.Summary || '',
        sentimentScore: raw.SentimentScore ?? 0,
        recordingUrl: raw.RecordingUrl || raw.Url || '',
        isArchived: raw.IsArchived ?? false,
    };
}

function escapeOData(value) {
    return String(value).replace(/'/g, "''");
}

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
    if (time) return parseInt(time[1] || 0) * 86400 + parseInt(time[2] || 0) * 3600 + parseInt(time[3] || 0) * 60 + parseInt(time[4] || 0);
    const numeric = Number(text);
    return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function formatDateTimeBoundary(value, boundary) {
    const text = String(value);
    if (text.includes('T')) return text;
    return `${text}${boundary === 'start' ? 'T00:00:00Z' : 'T23:59:59Z'}`;
}

function addSecondsToDate(value, seconds) {
    if (!value || !seconds) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() + seconds * 1000).toISOString();
}

module.exports = { getRecordings, downloadRecording };
