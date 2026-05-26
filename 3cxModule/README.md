# @omniyat/3cx-module

Module Node.js pour interagir avec l'API 3CX : historique d'appels, enregistrements, extensions et statut systeme.

## Installation

```bash
npm install @omniyat/3cx-module
```

Ou en local :

```bash
npm install file:../3cxModule
```

## Configuration

### Option 1 : Variables d'environnement

```env
THREECX_BASE_URL=https://monentreprise.3cx.fr
THREECX_EXTENSION=100
THREECX_PASSWORD=mon_mot_de_passe
```

### Option 2 : Initialisation manuelle

```js
const threecx = require("@omniyat/3cx-module");

await threecx.init({
  baseUrl: "https://monentreprise.3cx.fr",
  extension: "100",
  password: "mon_mot_de_passe",
});
```

## API Reference

### `init(options?)`

Initialise la connexion au serveur 3CX. L'authentification et le rafraichissement du token sont geres automatiquement.

| Parametre  | Type     | Description                     |
|------------|----------|---------------------------------|
| `baseUrl`  | `string` | URL du serveur 3CX             |
| `extension`| `string` | Numero de l'extension           |
| `password` | `string` | Mot de passe du client web      |
| `timeout`  | `number` | Timeout HTTP en ms (optionnel)  |

### `getCallHistory(options?)`

Retourne l'historique des appels avec pagination.

| Parametre   | Type     | Description                          |
|-------------|----------|--------------------------------------|
| `startDate` | `string` | Date de debut (ISO 8601)             |
| `endDate`   | `string` | Date de fin (ISO 8601)               |
| `caller`    | `string` | Filtrer par appelant                 |
| `callee`    | `string` | Filtrer par appele                   |
| `status`    | `string` | Filtrer par statut                   |
| `page`      | `number` | Numero de page                       |
| `pageSize`  | `number` | Nombre d'elements par page           |

### `getAllCallHistory(options?)`

Retourne tout l'historique des appels (pagination automatique). Memes parametres que `getCallHistory` sauf `page` et `pageSize`.

### `getRecordings(options?)`

Retourne la liste des enregistrements avec pagination. Memes parametres que `getCallHistory`.

### `downloadRecording(recordingId)`

Retourne un flux (stream) pour telecharger un enregistrement audio.

### `getExtensions()`

Retourne la liste de toutes les extensions avec leur statut.

### `getSystemStatus()`

Retourne le statut du systeme 3CX.

### `getActiveCalls()`

Retourne la liste des appels en cours.

---

## Exemples React

Les exemples ci-dessous supposent que l'API Express `@omniyat/3cx-api` tourne sur `http://localhost:3000` et sert de proxy vers le module 3CX.

### Configuration du client API

```tsx
// src/lib/api.ts
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const API_KEY = import.meta.env.VITE_API_KEY || "";

export async function api<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Erreur API : ${res.status} ${res.statusText}`);
  }

  return res.json();
}
```

---

### Hook : useCallHistory

```tsx
// src/hooks/useCallHistory.ts
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface CallRecord {
  id: string;
  caller: string;
  callee: string;
  startTime: string;
  duration: number;
  status: string;
}

interface CallHistoryResponse {
  data: CallRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useCallHistory(page = 1, pageSize = 20) {
  const [data, setData] = useState<CallHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api<CallHistoryResponse>("/api/calls/history", {
      page: String(page),
      pageSize: String(pageSize),
    })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  return { data, loading, error };
}
```

---

### Composant : Tableau d'historique d'appels

```tsx
// src/components/CallHistoryTable.tsx
import { useState } from "react";
import { useCallHistory } from "../hooks/useCallHistory";

export function CallHistoryTable() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useCallHistory(page);

  if (loading) return <p>Chargement...</p>;
  if (error) return <p style={{ color: "red" }}>Erreur : {error}</p>;
  if (!data) return null;

  return (
    <div>
      <h2>Historique des appels</h2>
      <table>
        <thead>
          <tr>
            <th>Appelant</th>
            <th>Appele</th>
            <th>Date</th>
            <th>Duree (s)</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((call) => (
            <tr key={call.id}>
              <td>{call.caller}</td>
              <td>{call.callee}</td>
              <td>{new Date(call.startTime).toLocaleString("fr-FR")}</td>
              <td>{call.duration}</td>
              <td>{call.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Precedent
        </button>
        <span>
          Page {data.page} / {data.totalPages}
        </span>
        <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
          Suivant
        </button>
      </div>
    </div>
  );
}
```

---

### Hook : useExtensions

```tsx
// src/hooks/useExtensions.ts
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Extension {
  id: string;
  number: string;
  name: string;
  status: string;
}

export function useExtensions() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Extension[] }>("/api/system/extensions")
      .then((res) => setExtensions(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { extensions, loading, error };
}
```

---

### Composant : Liste des extensions

```tsx
// src/components/ExtensionList.tsx
import { useExtensions } from "../hooks/useExtensions";

const STATUS_COLORS: Record<string, string> = {
  Available: "#22c55e",
  Away: "#f59e0b",
  DND: "#ef4444",
  Offline: "#94a3b8",
};

export function ExtensionList() {
  const { extensions, loading, error } = useExtensions();

  if (loading) return <p>Chargement...</p>;
  if (error) return <p style={{ color: "red" }}>Erreur : {error}</p>;

  return (
    <div>
      <h2>Extensions</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {extensions.map((ext) => (
          <li key={ext.id} style={{ padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: STATUS_COLORS[ext.status] || "#94a3b8",
                display: "inline-block",
              }}
            />
            <strong>{ext.number}</strong> — {ext.name}
            <span style={{ color: "#666", fontSize: 14 }}>({ext.status})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### Hook : useActiveCalls (polling temps reel)

```tsx
// src/hooks/useActiveCalls.ts
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface ActiveCall {
  id: string;
  caller: string;
  callee: string;
  status: string;
  duration: number;
}

export function useActiveCalls(intervalMs = 5000) {
  const [calls, setCalls] = useState<ActiveCall[]>([]);

  useEffect(() => {
    const fetchCalls = () =>
      api<{ data: ActiveCall[] }>("/api/calls/active")
        .then((res) => setCalls(res.data))
        .catch(console.error);

    fetchCalls();
    const timer = setInterval(fetchCalls, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return calls;
}
```

---

### Composant : Appels en cours

```tsx
// src/components/ActiveCalls.tsx
import { useActiveCalls } from "../hooks/useActiveCalls";

export function ActiveCalls() {
  const calls = useActiveCalls(3000);

  return (
    <div>
      <h2>Appels en cours ({calls.length})</h2>
      {calls.length === 0 ? (
        <p>Aucun appel en cours</p>
      ) : (
        <ul>
          {calls.map((call) => (
            <li key={call.id}>
              {call.caller} → {call.callee} ({call.duration}s)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

### Composant : Lecteur d'enregistrement

```tsx
// src/components/RecordingPlayer.tsx
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const API_KEY = import.meta.env.VITE_API_KEY || "";

interface Props {
  recordingId: string;
}

export function RecordingPlayer({ recordingId }: Props) {
  const downloadUrl = `${API_URL}/api/recordings/${recordingId}/download`;

  const handlePlay = async () => {
    const res = await fetch(downloadUrl, {
      headers: { "x-api-key": API_KEY },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span>Enregistrement {recordingId}</span>
      <button onClick={handlePlay}>Ecouter</button>
      <a
        href={downloadUrl}
        download={`recording-${recordingId}.mp3`}
        style={{ fontSize: 14 }}
      >
        Telecharger
      </a>
    </div>
  );
}
```

---

### Page complete : Dashboard 3CX

```tsx
// src/pages/Dashboard.tsx
import { CallHistoryTable } from "../components/CallHistoryTable";
import { ExtensionList } from "../components/ExtensionList";
import { ActiveCalls } from "../components/ActiveCalls";

export function Dashboard() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1>Dashboard 3CX</h1>
      <ActiveCalls />
      <hr />
      <ExtensionList />
      <hr />
      <CallHistoryTable />
    </div>
  );
}
```

---

## Variables d'environnement React (Vite)

```env
# .env
VITE_API_URL=http://localhost:3000
VITE_API_KEY=votre-cle-api-secrete
```
