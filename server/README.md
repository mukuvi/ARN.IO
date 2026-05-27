## Backend (Express + PostgreSQL)

### Prereqs

- Node.js + npm
- PostgreSQL running locally

### Environment

The backend reads its database config from environment variables (via `dotenv`). Create `server/.env` (or export vars in your shell):

- `PG_HOST` (default: `localhost`)
- `PG_PORT` (default: `5432`)
- `PG_USER` (default: `mukuvi`)
- `PG_PASSWORD` (default: `arnio2024`)
- `PG_DATABASE` (default: `arnio`)

Optional AI keys:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`

See `server/.env.example` for a template.

### Local DB setup (recommended)

Create (or reset) the dev role and database to match the defaults used by the backend:

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mukuvi') THEN
		CREATE ROLE mukuvi LOGIN PASSWORD 'arnio2024';
	ELSE
		ALTER ROLE mukuvi WITH LOGIN PASSWORD 'arnio2024';
	END IF;
END
$$;
SQL

sudo -u postgres createdb -O mukuvi arnio 2>/dev/null || true
```

### Run

From the repo root:

```bash
./run.sh
```

Backend health check:

```bash
curl -s http://localhost:3001/api/health
```
