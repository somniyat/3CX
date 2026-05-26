# 3CX - Omniyat

Solution complete pour interagir avec un serveur 3CX : module d'integration, API REST et dashboard de supervision.

## Architecture

```
3CX/
  3cxModule/       Module Node.js d'integration 3CX (OAuth2, appels, enregistrements)
  3cx-api/         API REST Express (proxy stateless vers le module)
  3cx-dashboard/   Interface web React + Vite
```

```
Dashboard (React)  --->  API (Express)  --->  Module  --->  Serveur 3CX
     :5173               :3002                              :5001
```

## Principe cle : credentials dynamiques

L'API ne stocke aucune configuration 3CX par defaut. Ce sont les **clients** (dashboard, curl, autre service) qui fournissent les credentials de connexion 3CX dans chaque requete via des query params :

| Query param    | Description                                      |
|----------------|--------------------------------------------------|
| `baseUrl`      | URL du serveur 3CX (ex: `https://xxx.3cx.ch:5001`) |
| `clientId`     | Client ID OAuth2 du serveur 3CX                  |
| `clientSecret` | Client Secret OAuth2 du serveur 3CX              |

Ces 3 parametres sont **obligatoires** pour chaque appel API. Ils servent a la fois :
- d'**authentification** (seul quelqu'un qui connait les credentials peut appeler l'API)
- de **connexion** au serveur 3CX cible (l'API se connecte au serveur indique)

Cela permet a un meme serveur API de se connecter a **plusieurs serveurs 3CX differents** selon la requete.

### Fallback .env (optionnel)

Si certains credentials sont configures dans le `.env` de l'API, ils servent de **valeurs par defaut**. Par exemple si `baseUrl` et `clientId` sont dans le `.env`, le client peut ne fournir que `clientSecret` dans l'URL.

Resolution de chaque parametre :

```
valeur dans l'URL ?  →  on l'utilise
sinon, valeur dans .env ?  →  on l'utilise
sinon  →  401 (parametre manquant)
```

### Exemple concret

```
                   Dashboard (.env)                     API (.env)
              ┌─────────────────────┐            ┌──────────────────┐
              │ VITE_THREECX_BASE_URL=...  │            │ (vide ou partiel)  │
              │ VITE_THREECX_CLIENT_ID=... │            │                    │
              │ VITE_THREECX_CLIENT_SECRET=│            │                    │
              └──────────┬──────────┘            └────────┬─────────┘
                         │                                │
                         ▼                                │
  Le dashboard ajoute les 3 valeurs                       │
  en query params a chaque requete                        │
                         │                                │
                         ▼                                ▼
  GET /api/recordings?baseUrl=...&clientId=...&clientSecret=...
                         │
                         ▼
                 L'API recoit les 3 valeurs,
                 cree une connexion au serveur 3CX
                 et retourne les donnees
```

## Demarrage rapide

### 1. Module 3CX

```bash
cd 3cxModule
npm install
npm run build
```

### 2. API

```bash
cd 3cx-api
npm install
```

Le fichier `.env` est **optionnel**. Seul `PORT` est utile :

```env
PORT=3002

# Optionnel : valeurs par defaut si le client ne les fournit pas dans l'URL
# THREECX_BASE_URL=https://votre-serveur.3cx.ch:5001
# THREECX_CLIENT_ID=votre-client-id
# THREECX_CLIENT_SECRET=votre-client-secret
```

```bash
npm run dev      # Developpement (hot-reload)
npm run build    # Compilation TypeScript
npm start        # Production
```

### 3. Dashboard

```bash
cd 3cx-dashboard
npm install
```

Creer un fichier `.env` avec les credentials du serveur 3CX a cibler. Le dashboard les enverra automatiquement dans chaque requete :

```env
VITE_THREECX_BASE_URL=https://votre-serveur.3cx.ch:5001
VITE_THREECX_CLIENT_ID=votre-client-id
VITE_THREECX_CLIENT_SECRET=votre-client-secret
```

```bash
npm run dev      # Serveur de developpement Vite
npm run build    # Build production
```

## Exemples d'appels API

### Depuis le navigateur ou curl (credentials complets)

```bash
curl "http://localhost:3002/api/system/status?baseUrl=https://mon-serveur.3cx.ch:5001&clientId=monId&clientSecret=monSecret"
```

### Depuis le navigateur ou curl (si baseUrl et clientId sont dans le .env de l'API)

```bash
curl "http://localhost:3002/api/system/status?clientSecret=monSecret"
```

### Sans credentials → erreur 401

```bash
curl http://localhost:3002/api/system/status
# → {"error":"Credentials 3CX manquants","missing":["baseUrl","clientId","clientSecret"]}
```

### Route publique (pas de credentials)

```bash
curl http://localhost:3002/health
# → {"status":"ok","timestamp":"..."}
```

## Endpoints

| Route | Description |
|-------|-------------|
| `GET /health` | Health check (public) |
| `GET /api/calls/history` | Historique d'appels (pagine) |
| `GET /api/calls/history/all` | Historique complet |
| `GET /api/calls/active` | Appels en cours |
| `GET /api/recordings` | Liste des enregistrements |
| `GET /api/recordings/:id/download` | Telecharger un enregistrement |
| `GET /api/transcriptions` | Liste des transcriptions |
| `GET /api/transcriptions/:id` | Detail d'une transcription |
| `GET /api/system/status` | Statut du systeme 3CX |
| `GET /api/system/extensions` | Liste des extensions |
| `GET /api/users` | Liste des utilisateurs |
| `GET /api/drivers` | Liste des chauffeurs |
| `GET /api/drivers/:id/dossier` | Dossier de communications |
| `GET /api/diagnostic/access-audit` | Audit des acces API 3CX |

Tous les endpoints `/api/*` necessitent `baseUrl`, `clientId` et `clientSecret` en query params (ou dans le `.env` de l'API en fallback).

## Tests

```bash
cd 3cx-api
npm test              # Lancer les tests
npm run test:watch    # Mode watch
npm run test:coverage # Couverture de code
```

## Stack technique

- **Module** : Node.js, Axios, OAuth2, Rollup
- **API** : Express 5, TypeScript, Zod, Helmet, Vitest
- **Dashboard** : React, Vite, TypeScript
