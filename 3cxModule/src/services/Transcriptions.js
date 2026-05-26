/**
 * Service de gestion des transcriptions via XAPI.
 * Les transcriptions sont integrees dans l'entite Recordings.
 */

/**
 * Recuperer la transcription d'un enregistrement.
 */
async function getTranscription(http, recordingId) {
    if (!recordingId) throw new Error('recordingId est requis.');

    const { data } = await http.get(`/xapi/v1/Recordings(${recordingId})`, {
        params: { $select: 'Id,Transcription,Summary,SentimentScore,IsTranscribed' },
    });

    return {
        id: data.Id?.toString() || recordingId,
        transcription: data.Transcription || '',
        summary: data.Summary || '',
        sentimentScore: data.SentimentScore ?? 0,
        isTranscribed: data.IsTranscribed ?? false,
        segments: parseTranscriptionSegments(data.Transcription),
    };
}

/**
 * Lister les enregistrements qui ont une transcription.
 */
async function getTranscriptions(http, options = {}) {
    const params = {
        $top: options.pageSize || 50,
        $skip: ((options.page || 0)) * (options.pageSize || 50),
        $count: true,
        $orderby: 'StartTime desc',
        $filter: 'IsTranscribed eq true',
    };

    if (options.startDate || options.endDate) {
        const filters = ['IsTranscribed eq true'];
        if (options.startDate) {
            filters.push(`StartTime ge ${options.startDate}T00:00:00Z`);
        }
        if (options.endDate) {
            filters.push(`StartTime le ${options.endDate}T23:59:59Z`);
        }
        params.$filter = filters.join(' and ');
    }

    const { data } = await http.get('/xapi/v1/Recordings', { params });

    const list = (data.value || []).map((raw) => ({
        id: raw.Id?.toString() || '',
        startTime: raw.StartTime || '',
        endTime: raw.EndTime || '',
        caller: raw.FromCallerNumber || raw.FromDisplayName || '',
        callee: raw.ToCallerNumber || raw.ToDisplayName || '',
        isTranscribed: raw.IsTranscribed ?? false,
        transcription: raw.Transcription || '',
        summary: raw.Summary || '',
    }));

    return {
        list,
        totalCount: data['@odata.count'] ?? list.length,
    };
}

/**
 * Tenter de parser le texte brut de transcription en segments.
 * Format attendu : "Speaker: texte\nSpeaker: texte..."
 */
function parseTranscriptionSegments(text) {
    if (!text) return [];

    const lines = text.split('\n').filter(Boolean);
    return lines.map((line) => {
        const match = line.match(/^(.+?):\s*(.+)$/);
        if (match) {
            return { speaker: match[1].trim(), text: match[2].trim() };
        }
        return { speaker: '', text: line.trim() };
    });
}

module.exports = { getTranscription, getTranscriptions };
