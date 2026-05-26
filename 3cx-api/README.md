# @omniyat/3cx-api

API REST Express pour interagir avec un serveur 3CX. Expose l'historique d'appels, les enregistrements, les extensions et le statut systeme via des endpoints securises par cle API.

## Installation

```bash
cd 3cx-api
npm install
```

## Configuration

Creer un fichier `.env` a la racine :

```env
PORT=3000
API_KEY=votre-cle-api-secrete

THREECX_BASE_URL=https://monentreprise.3cx.fr
THREECX_EXTENSION=100
THREECX_PASSWORD=mon_mot_de_passe
```

## Demarrage

```bash
# Developpement (hot-reload)
npm run dev

# Production
npm run build
npm start
```

## Authentification

Toutes les routes `/api/*` necessitent le header :

```
x-api-key: votre-cle-api-secrete
```

La route `/health` est publique.

---

## Endpoints

### Health Check

```
GET /health
```

```json
{ "status": "ok", "timestamp": "2026-04-20T12:00:00.000Z" }
```

---

### Historique d'appels

#### Liste paginee

```
GET /api/calls/history?startDate=2026-04-01&endDate=2026-04-20&page=1&pageSize=50
```

Parametres optionnels : `startDate`, `endDate`, `caller`, `callee`, `status`, `page`, `pageSize` (max 500).

#### Liste complete

```
GET /api/calls/history/all?startDate=2026-04-01&endDate=2026-04-20
```

Parametres optionnels : `startDate`, `endDate`, `caller`, `callee`, `status`.

---

### Appels en cours

```
GET /api/calls/active
```

---

### Enregistrements

#### Liste paginee

```
GET /api/recordings?startDate=2026-04-01&endDate=2026-04-20&page=1&pageSize=20
```

Parametres optionnels : `startDate`, `endDate`, `caller`, `callee`, `page`, `pageSize` (max 500).

#### Telecharger un enregistrement

```
GET /api/recordings/:id/download
```

Retourne un flux audio (`audio/mpeg`).

---

### Systeme

#### Statut

```
GET /api/system/status
```

#### Extensions

```
GET /api/system/extensions
```

---

## Exemples avec cURL

```bash
# Health check
curl http://localhost:3000/health

# Historique d'appels
curl -H "x-api-key: votre-cle-api-secrete" \
  "http://localhost:3000/api/calls/history?startDate=2026-04-01&pageSize=10"

# Appels en cours
curl -H "x-api-key: votre-cle-api-secrete" \
  http://localhost:3000/api/calls/active

# Liste des enregistrements
curl -H "x-api-key: votre-cle-api-secrete" \
  "http://localhost:3000/api/recordings?page=1&pageSize=20"

# Telecharger un enregistrement
curl -H "x-api-key: votre-cle-api-secrete" \
  -o recording.mp3 \
  http://localhost:3000/api/recordings/abc123/download

# Extensions
curl -H "x-api-key: votre-cle-api-secrete" \
  http://localhost:3000/api/system/extensions

# Statut systeme
curl -H "x-api-key: votre-cle-api-secrete" \
  http://localhost:3000/api/system/status
```

## Exemples avec fetch (JavaScript / TypeScript)

```ts
const API_URL = "http://localhost:3000";
const API_KEY = "votre-cle-api-secrete";

const headers = { "x-api-key": API_KEY };

// Historique d'appels
const history = await fetch(`${API_URL}/api/calls/history?page=1&pageSize=20`, { headers });
const data = await history.json();
console.log(data);

// Appels en cours
const active = await fetch(`${API_URL}/api/calls/active`, { headers });
console.log(await active.json());

// Extensions
const extensions = await fetch(`${API_URL}/api/system/extensions`, { headers });
console.log(await extensions.json());
```

---

## Structure du projet

```
src/
  index.ts              Point d'entree (bootstrap)
  app.ts                Configuration Express
  config/
    env.ts              Validation des variables d'environnement (Zod)
    3cx.ts              Initialisation du module 3CX
  middlewares/
    auth.ts             Authentification par cle API
    error.ts            Gestionnaire d'erreurs global
  routes/
    health.ts           GET /health
    calls.ts            Historique et appels actifs
    recordings.ts       Enregistrements
    system.ts           Statut et extensions
  types/
    3cx-module.d.ts     Declarations TypeScript pour @omniyat/3cx-module
```
