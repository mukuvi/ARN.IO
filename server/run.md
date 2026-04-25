# Run ARN.IO (commands)

## One command (runs backend + frontend)
From the repo root:

```bash
chmod +x run.sh
./run.sh
```

If the backend is already running on `3001`, `run.sh` will reuse it.
If the frontend (Vite) is already running on `5173`–`5180`, `run.sh` will reuse it.

## Database (PostgreSQL)
Start PostgreSQL (Ubuntu/Debian):

```bash
sudo systemctl start postgresql
```

Create user + database (run once):

```bash
sudo -u postgres createuser -P mukuvi
sudo -u postgres createdb -O mukuvi arnio
```

## Backend (Terminal 1)
From the repo root:

```bash
cd server
npm install
npm run dev
```

Health check:

```bash
curl http://localhost:3001/api/health
```

## Frontend (Terminal 2)
From the repo root:

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/`, but it may use 5174+ if busy).

## Optional env overrides (backend)

```bash
PG_USER=... PG_PASSWORD=... PG_HOST=... PG_PORT=5432 PG_DATABASE=arnio PORT=3001 npm run dev
```
