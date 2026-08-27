# Railway Deployment

**Deployed at:** https://mobile-money-production-b493.up.railway.app
(health check: `/api/health`)


## Environment variables

The image contains **no `.env`**. It holds `JWT_SECRET` and `DB_PASSWORD`, so it
is not tracked in git, and the Dockerfile does not copy it. Railway injects
variables into the container environment instead, and `dotenv.config()` is a
no-op when the file is absent — `process.env` is left intact.

Every variable below must be set under **Service → Variables**, or the image
will build and then fail at boot:

| Variable | Notes |
|---|---|
| `DB_HOST` | Railway MySQL host |
| `DB_PORT` | `3306` |
| `DB_USER` | |
| `DB_PASSWORD` | |
| `DB_NAME` | |
| `JWT_SECRET` | **Use a new value.** The previous secret is readable in this repository's git history, so reusing it leaves tokens forgeable. |
| `PORT` | Railway sets this; `server.js` listens on it |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Used for CORS |
| `API_URL` / `API_PRODUCTION_URL` | |

Optional — only needed for SMS verification to actually send:
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

## The frontend API URL is baked in at build time

`frontend/.env.production` sets `VITE_API_URL` and `VITE_SOCKET_URL`, and Vite
inlines them into the bundle during `npm run build`. Setting them in the Railway
dashboard has no effect on an already-built frontend — change the file and
rebuild.

## Build notes

Two things about the Dockerfile that are easy to break:

- **`npm install --include=dev` in the frontend stage is required.** `vite` and
  `@vitejs/plugin-react` are devDependencies, and `railway.json` sets
  `NODE_ENV=production`, under which npm omits devDependencies — leaving no
  `node_modules/.bin/vite` and failing the build.
- **Nothing copies `.env`.** Re-adding `COPY .env` reintroduces a build failure
  (`"/.env": not found`) and would bake secrets into the image layers.

## If a build fails with `"/.env": not found`

That instruction no longer exists in the Dockerfile, so the build is not running
the current code. Check both:

1. **The commit being built.** Pressing *Redeploy* on a failed deployment
   rebuilds **that same commit**, not the latest. Use *Deploy latest commit*, or
   push a new commit to trigger a fresh build.
2. **The build cache.** If the deployment is on the right commit, clear the
   build cache and redeploy without it.
