import { useMemo, useRef, useState } from 'react';
import { Download, FileText, Filter, Pause, Play } from 'lucide-react';
import { getRecordingDownloadUrl, getRecordings, type Recording } from '../api';
import { useFetch } from '../hooks/useFetch';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

const PAGE_SIZE = 50;

type Filters = {
  startDate: string;
  endDate: string;
  caller: string;
  callee: string;
  phone: string;
  transcribed: string;
};

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR');
}

function formatDuration(seconds?: number) {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(safeSeconds / 60)}m ${(safeSeconds % 60).toString().padStart(2, '0')}s`;
}

function participant(number?: string, name?: string) {
  return [name, number].filter(Boolean).join(' · ') || '-';
}

export default function Recordings() {
  const [page, setPage] = useState(1);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ startDate: '', endDate: '', caller: '', callee: '', phone: '', transcribed: '' });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const params = useMemo(() => {
    const entries = Object.entries(filters).filter(([, value]) => value);
    return Object.fromEntries([...entries, ['page', String(page)], ['pageSize', String(PAGE_SIZE)]]) as Record<string, string>;
  }, [filters, page]);

  const { data, loading, error } = useFetch(() => getRecordings(params), [params]);
  const rows = data?.list ?? [];

  const updateFilter = (name: keyof Filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const togglePlayback = (rec: Recording) => {
    const url = getRecordingDownloadUrl(rec.id);
    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    audio.play();
    setPlayingId(rec.id);
  };

  return (
    <div className="page recordings-page">
      <p className="eyebrow">Preuves d'appel</p>
      <h1>Enregistrements et transcriptions</h1>
      <p className="page-subtitle">
        Les transcriptions affichées ici proviennent directement des enregistrements 3CX.
        Aucun appel séparé à <span className="mono">/api/transcriptions/:id</span> n'est nécessaire tant qu'elles ne sont pas générées.
      </p>

      {loading && !data && <Loader />}
      {error && <ErrorMessage message={error} />}

      <section className="filter-panel">
        <div className="filter-panel-title"><Filter size={18} /> Filtres enregistrements</div>
        <div className="filters filters-grid">
          <label>Du <input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} /></label>
          <label>Au <input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} /></label>
          <label>Appelant <input placeholder="chauffeur" value={filters.caller} onChange={(e) => updateFilter('caller', e.target.value)} /></label>
          <label>Appelé <input placeholder="client" value={filters.callee} onChange={(e) => updateFilter('callee', e.target.value)} /></label>
          <label>Téléphone <input placeholder="chauffeur ou client" value={filters.phone} onChange={(e) => updateFilter('phone', e.target.value)} /></label>
          <label>
            Transcript
            <select value={filters.transcribed} onChange={(e) => updateFilter('transcribed', e.target.value)}>
              <option value="">Tous</option>
              <option value="true">Disponible</option>
              <option value="false">Non disponible</option>
            </select>
          </label>
          <button className="btn" onClick={() => { setPage(1); setFilters({ startDate: '', endDate: '', caller: '', callee: '', phone: '', transcribed: '' }); }}>
            Réinitialiser
          </button>
        </div>
      </section>

      {data && (
        <>
          <div className="section-header">
            <p className="total-count">{data.totalCount} enregistrements</p>
            {loading && <span className="muted">Actualisation...</span>}
          </div>
          <div className="table-wrap">
          <table className="table recordings-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Appelant</th>
                <th>Appelé</th>
                <th>Durée</th>
                <th>Audio</th>
                <th>Transcription relative</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((rec, i) => {
                const transcript = (rec.transcription || '').trim();
                return (
                  <tr key={rec.id ?? i}>
                    <td>{formatDate(rec.startTime || String(rec.date || ''))}</td>
                    <td>{participant(rec.caller, rec.callerName)}</td>
                    <td>{participant(rec.callee, rec.calleeName)}</td>
                    <td>{formatDuration(rec.duration)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => togglePlayback(rec)}>
                          {playingId === rec.id ? <Pause size={14} /> : <Play size={14} />}
                          {playingId === rec.id ? 'Pause' : 'Écouter'}
                        </button>
                        <a href={getRecordingDownloadUrl(rec.id)} className="btn btn-sm" download>
                          <Download size={14} /> Télécharger
                        </a>
                      </div>
                    </td>
                    <td className="transcript-cell wide">
                      {transcript ? (
                        <details open={rows.length <= 5}>
                          <summary><FileText size={14} /> Voir le transcript</summary>
                          {rec.summary && <p className="transcript-summary"><strong>Résumé :</strong> {rec.summary}</p>}
                          <p>{transcript}</p>
                        </details>
                      ) : (
                        <span className="muted">Transcript pas encore disponible</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {!rows.length && !loading && <p className="empty-state">Aucun enregistrement ne correspond aux filtres.</p>}
          <div className="pagination">
            <button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Précédent</button>
            <span>Page {page}</span>
            <button disabled={rows.length < PAGE_SIZE || loading} onClick={() => setPage(page + 1)}>Suivant</button>
          </div>
        </>
      )}
    </div>
  );
}
