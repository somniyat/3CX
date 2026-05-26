import { useMemo, useState } from 'react';
import { Download, FileText, Filter, Mic, PhoneCall, Search, Timer, Truck } from 'lucide-react';
import { getCallHistory, getRecordingDownloadUrl, listDrivers, type CallRecord, type Driver } from '../api';
import { useFetch } from '../hooks/useFetch';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';

type Filters = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  driverId: string;
  phone: string;
  status: string;
};

const PAGE_SIZE = 50;

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR');
}

function formatDuration(seconds?: number) {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
}

function compactParty(number?: string, name?: string) {
  const label = [name, number].filter(Boolean).join(' · ');
  return label || '-';
}

function transcriptText(call: CallRecord) {
  const transcript = call.transcript?.transcription || call.recording?.transcription || '';
  return transcript.trim();
}

export default function Dashboard() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    driverId: '',
    phone: '',
    status: '',
  });

  const params = useMemo(() => {
    const entries = Object.entries(filters).filter(([, value]) => value);
    return Object.fromEntries([...entries, ['page', String(page)], ['pageSize', String(PAGE_SIZE)]]) as Record<string, string>;
  }, [filters, page]);

  const calls = useFetch(() => getCallHistory(params), [params]);
  const drivers = useFetch(() => listDrivers());

  const rows = calls.data?.list ?? [];
  const total = calls.data?.totalCount ?? 0;
  const answered = rows.filter((call) => call.status === 'answered').length;
  const withRecording = rows.filter((call) => call.recording || call.recordingId).length;
  const withTranscript = rows.filter((call) => transcriptText(call)).length;

  const updateFilter = (name: keyof Filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  };

  if (calls.loading && !calls.data) return <Loader />;

  return (
    <div className="page audit-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Contrôle qualité livraison</p>
          <h1>Dashboard des appels chauffeurs</h1>
          <p className="page-subtitle">
            Vérifier que les chauffeurs appellent les clients avant la livraison, avec la durée,
            l'enregistrement et la transcription lorsqu'elle est déjà générée par 3CX.
          </p>
        </div>
      </div>

      {calls.error && <ErrorMessage message={calls.error} />}

      <div className="cards-grid">
        <div className="card card-blue">
          <div className="card-icon"><PhoneCall size={28} /></div>
          <div className="card-body"><span className="card-value">{total}</span><span className="card-label">Appels filtrés</span></div>
        </div>
        <div className="card card-green">
          <div className="card-icon"><Timer size={28} /></div>
          <div className="card-body"><span className="card-value">{answered}</span><span className="card-label">Appels répondus sur cette page</span></div>
        </div>
        <div className="card card-purple">
          <div className="card-icon"><Mic size={28} /></div>
          <div className="card-body"><span className="card-value">{withRecording}</span><span className="card-label">Avec enregistrement</span></div>
        </div>
        <div className="card card-orange">
          <div className="card-icon"><FileText size={28} /></div>
          <div className="card-body"><span className="card-value">{withTranscript}</span><span className="card-label">Avec transcript</span></div>
        </div>
      </div>

      <section className="filter-panel">
        <div className="filter-panel-title"><Filter size={18} /> Filtres d'audit</div>
        <div className="filters filters-grid">
          <label>Du <input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} /></label>
          <label>Au <input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} /></label>
          <label>Heure début <input type="time" value={filters.startTime} onChange={(e) => updateFilter('startTime', e.target.value)} /></label>
          <label>Heure fin <input type="time" value={filters.endTime} onChange={(e) => updateFilter('endTime', e.target.value)} /></label>
          <label>
            Chauffeur
            <select value={filters.driverId} onChange={(e) => updateFilter('driverId', e.target.value)}>
              <option value="">Tous</option>
              {((drivers.data as { data?: Driver[] } | undefined)?.data ?? []).map((driver: Driver) => (
                <option key={driver.id} value={driver.id}>{driver.name} ({driver.extension})</option>
              ))}
            </select>
          </label>
          <label>Téléphone <input placeholder="chauffeur ou client" value={filters.phone} onChange={(e) => updateFilter('phone', e.target.value)} /></label>
          <label>
            Statut
            <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
              <option value="">Tous</option>
              <option value="answered">Répondu</option>
              <option value="missed">Manqué</option>
            </select>
          </label>
          <button className="btn" onClick={() => { setPage(1); setFilters({ startDate: '', endDate: '', startTime: '', endTime: '', driverId: '', phone: '', status: '' }); }}>
            <Search size={16} /> Réinitialiser
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Historique des appels effectués</h2>
          {calls.loading && <span className="muted">Actualisation...</span>}
        </div>
        <div className="table-wrap">
        <table className="table audit-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Chauffeur / appelant</th>
              <th>Client / appelé</th>
              <th>Durée</th>
              <th>Statut</th>
              <th>Enregistrement</th>
              <th>Transcript</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((call, index) => {
              const recordingId = call.recording?.id || call.recordingId || '';
              const text = transcriptText(call);
              return (
                <tr key={call.id || index}>
                  <td>{formatDate(call.startTime)}</td>
                  <td>
                    <div className="party-cell">
                      {call.driver && <span className="driver-chip"><Truck size={13} /> {call.driver.name}</span>}
                      {compactParty(call.caller, call.callerName)}
                    </div>
                  </td>
                  <td>{compactParty(call.callee, call.calleeName)}</td>
                  <td className={call.duration ? '' : 'duration-warning'}>{formatDuration(call.duration)}</td>
                  <td><StatusBadge status={call.status} /></td>
                  <td>
                    {recordingId ? (
                      <a className="btn btn-sm" href={getRecordingDownloadUrl(recordingId)} download><Download size={14} /> Audio</a>
                    ) : <span className="muted">Aucun</span>}
                  </td>
                  <td className="transcript-cell">
                    {text ? <details><summary>Voir</summary><p>{text}</p></details> : <span className="muted">Non disponible</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {!rows.length && !calls.loading && <p className="empty-state">Aucun appel ne correspond aux filtres.</p>}
        <div className="pagination">
          <button disabled={page <= 1 || calls.loading} onClick={() => setPage(page - 1)}>Précédent</button>
          <span>Page {page}</span>
          <button disabled={rows.length < PAGE_SIZE || calls.loading} onClick={() => setPage(page + 1)}>Suivant</button>
        </div>
      </section>
    </div>
  );
}
