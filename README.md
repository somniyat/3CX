# 3CX - Omniyat

API d'integration 3CX permettant de recuperer l'historique des appels d'un serveur 3CX a partir de numeros de telephone et de creneaux horaires.

## Architecture

```
3CX/
  3cxModule/       Module Node.js d'integration 3CX (OAuth2, appels, enregistrements)
  3cx-api/         API REST Express (proxy stateless vers le module)
  3cx-dashboard/   Interface web React + Vite (optionnel)
```

```
Client (curl, app, dashboard)  --->  API Express  --->  3cxModule  --->  Serveur 3CX
                                       :3002                               :5001
```

## Cas d'usage principal

Fournir un ou plusieurs numeros de telephone et un creneau horaire, et obtenir en retour l'historique des appels effectues ou recus par ces numeros sur cette periode.

```bash
curl -X POST http://localhost:3002/api/calls/lookup \
  -H "Content-Type: application/json" \
  -H "x-3cx-base-url: https://votre-serveur.3cx.ch:5001" \
  -H "x-3cx-client-id: votre-client-id" \
  -H "x-3cx-client-secret: votre-secret" \
  -d '{
    "phones": ["+41791234567", "1001"],
    "from": "2025-06-01",
    "to": "2025-06-07"
  }'
```

Reponse :

```json
{
  "query": { "phones": ["+41791234567", "1001"], "from": "2025-06-01", "to": "2025-06-07" },
  "totalMatched": 42,
  "page": 1,
  "pageSize": 50,
  "totalPages": 1,
  "calls": [
    {
      "id": "123",
      "caller": "+41791234567",
      "callerName": "Jean Dupont",
      "callee": "1002",
      "calleeName": "Accueil",
      "startTime": "2025-06-03T09:15:00Z",
      "endTime": "2025-06-03T09:18:30Z",
      "duration": 210,
      "status": "answered"
    }
  ],
  "byPhone": {
    "+41791234567": [ /* appels impliquant ce numero */ ],
    "1001": [ /* appels impliquant cette extension */ ]
  }
}
```

## Authentification

Les credentials 3CX sont transmis via **headers HTTP** (jamais en query params) :

| Header | Description |
|--------|-------------|
| `x-3cx-base-url` | URL du serveur 3CX (ex: `https://xxx.3cx.ch:5001`) |
| `x-3cx-client-id` | Client ID OAuth2 |
| `x-3cx-client-secret` | Client Secret OAuth2 |

Ces 3 headers sont **obligatoires** pour chaque appel `/api/*`. Ils servent a la fois d'authentification et de connexion au serveur 3CX cible. Un meme serveur API peut donc se connecter a **plusieurs serveurs 3CX differents** selon la requete.

Si des credentials sont configures dans le `.env` de l'API, ils servent de valeurs par defaut (le client peut alors omettre certains headers).

## Demarrage rapide

### Avec Docker (recommande)

```bash
# Configurer l'environnement
cp 3cx-api/.env.example 3cx-api/.env
# Editer 3cx-api/.env avec vos valeurs

# Lancer
docker compose up -d
```

L'API est disponible sur `http://localhost:3002`, le dashboard sur `http://localhost:80`.

### Sans Docker

```bash
# 1. Builder le module
cd 3cxModule && npm install && npm run build && cd ..

# 2. Lancer l'API
cd 3cx-api && npm install
cp .env.example .env   # Editer avec vos valeurs
npm run dev             # Dev (hot-reload) ou npm start (prod)
```

### Configuration (.env)

```env
PORT=3002
NODE_ENV=production

# Credentials 3CX par defaut (optionnel, fallback si pas dans les headers)
# THREECX_BASE_URL=https://votre-serveur.3cx.ch:5001
# THREECX_CLIENT_ID=votre-client-id
# THREECX_CLIENT_SECRET=votre-secret

# Securite
CORS_ORIGINS=https://app.example.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

## Endpoints

### Recherche d'appels

| Methode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/calls/lookup` | **Recherche d'appels par numeros + creneau** |
| `GET` | `/api/calls/history` | Historique pagine (filtres en query params) |
| `GET` | `/api/calls/history/all` | Historique complet |
| `GET` | `/api/calls/active` | Appels en cours |

### `POST /api/calls/lookup`

Le endpoint principal. Accepte un body JSON :

```json
{
  "phones": ["+41791234567", "1001", "+33612345678"],
  "from": "2025-06-01",
  "to": "2025-06-07T23:59:59Z",
  "page": 1,
  "pageSize": 50
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `phones` | `string[]` | oui | Numeros de telephone ou extensions a rechercher |
| `from` | `string` | oui | Debut du creneau (ISO 8601 ou `YYYY-MM-DD`) |
| `to` | `string` | oui | Fin du creneau |
| `page` | `number` | non | Page (defaut: 1) |
| `pageSize` | `number` | non | Taille de page, max 500 (defaut: 50) |

La correspondance des numeros est flexible : `+41791234567`, `0791234567`, `791234567` matcheront le meme numero.

### Enregistrements et transcriptions

| Methode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/recordings` | Liste des enregistrements (filtrable) |
| `GET` | `/api/recordings/:id/download` | Telecharger un enregistrement audio |
| `GET` | `/api/transcriptions` | Liste des transcriptions |
| `GET` | `/api/transcriptions/:id` | Detail d'une transcription |

### Systeme et utilisateurs

| Methode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/system/status` | Statut du serveur 3CX |
| `GET` | `/api/system/extensions` | Liste des extensions |
| `GET` | `/api/users` | Liste des utilisateurs |

### Chauffeurs (controle qualite)

| Methode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/drivers` | Liste des chauffeurs |
| `POST` | `/api/drivers` | Creer un chauffeur |
| `PUT` | `/api/drivers/:id` | Modifier un chauffeur |
| `DELETE` | `/api/drivers/:id` | Supprimer un chauffeur |
| `GET` | `/api/drivers/:id/dossier` | Dossier complet de communications |

### Monitoring

| Methode | Route | Description |
|---------|-------|-------------|
| `GET` | `/health` | Health check avec verification connectivite 3CX (public) |
| `GET` | `/api/diagnostic/access-audit` | Audit des acces (dev uniquement) |

## Securite

- **Credentials via headers HTTP** : jamais exposes dans les URLs ou les logs
- **CORS restreint** : seules les origines listees dans `CORS_ORIGINS` sont acceptees
- **Rate limiting** : 100 requetes/minute par IP (configurable)
- **Helmet** : headers de securite HTTP
- **Logging structure (Pino)** : les secrets sont automatiquement masques dans les logs
- **Endpoint diagnostic** : desactive en production
- **Cache LRU** : max 50 instances, TTL 30 min, pas de fuite memoire

## Tests

```bash
cd 3cx-api
npm test              # Lancer les tests
npm run test:watch    # Mode watch
npm run test:coverage # Couverture de code
```

## Stack technique

- **Module** : Node.js, Axios, OAuth2 (client_credentials), Rollup
- **API** : Express 5, TypeScript, Zod, Helmet, Pino, express-rate-limit, Vitest
- **Dashboard** : React 19, Vite, TypeScript
- **Deploiement** : Docker, Docker Compose, Nginx
