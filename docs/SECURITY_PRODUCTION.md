# Production Security Notes

## Dashboard protection
- Never expose dashboard publicly without access controls.
- Restrict dashboard by IP allowlist, VPN, or Zero Trust access proxy.
- Put dashboard behind HTTPS and enable authentication at edge proxy.
- Do not share API keys in browser URLs or logs.

## Deployment profile
Use:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d
```

## Required production settings
- `NODE_ENV=production`
- `DATABASE_SYNCHRONIZE=false`
- `CORS_ORIGINS` must be explicit origins.
- `WS_ALLOWED_ORIGINS` must be explicit origins.

## Webhook SSRF guardrails
Webhook URLs resolving to loopback, private, link-local, and cloud metadata IP ranges are blocked.


## First boot (production-safe main/auth schema init)
The app now bootstraps the minimal `api_keys` schema automatically when missing while keeping `synchronize=false`.

```bash
cp .env.production.example .env.production
# edit secrets/origins
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d --build
```
