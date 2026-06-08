# 3CX Dashboard — Audit Livraison

Dashboard de controle qualite livraison : verifier que les chauffeurs appellent les clients avant la livraison, avec la duree, et la transcription lorsqu'elle est generee par 3CX.

## Architecture

```
3CX/
├── 3cx-api/          # Backend — Express/Fastify (port 3002)
├── 3cx-dashboard/    # Frontend — React + TypeScript + Vite (port 5173)
└── docker-compose.yml
```

Le frontend proxy les appels `/api` vers le backend (port 3002) via Vite.

## Stack

| Couche   | Technologies                                       |
| -------- | -------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router, Lucide   |
| Backend  | Node.js (port 3002)                                |

## Pages

- **Dashboard** (`/`) — Historique des appels chauffeurs avec filtres (date, heure, chauffeur, telephone, statut)
- **Enregistrements** (`/recordings`) — Liste des enregistrements d'appels

## Prerequis

- Node.js >= 18
- Le backend `3cx-api` lance sur le port 3002
- Un serveur 3CX avec des credentials API

## Installation

```bash
cd 3cx-dashboard
npm install
```

## Configuration

Copier le fichier d'exemple et renseigner les credentials 3CX :

```bash
cp .env.example .env
```

Variables requises dans `.env` :

| Variable                    | Description                        |
| --------------------------- | ---------------------------------- |
| VITE_THREECX_BASE_URL       | URL du serveur 3CX                 |
| VITE_THREECX_CLIENT_ID      | Client ID de l'API 3CX             |
| VITE_THREECX_CLIENT_SECRET  | Client Secret de l'API 3CX         |

## Lancement

```bash
# Demarrer le backend d'abord
cd ../3cx-api
npm run dev

# Puis le frontend
cd ../3cx-dashboard
npm run dev
```

Le dashboard est accessible sur [http://localhost:5173](http://localhost:5173).

## Build production

```bash
npm run build
```

Les fichiers statiques sont generes dans `dist/`.
