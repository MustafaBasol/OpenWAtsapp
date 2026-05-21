# OpenWA Secure VPS Deployment Package (Autoviseo)

Target:
- API: `openwa-api.autoviseo.com`
- Dashboard: `openwa-panel.autoviseo.com`
- n8n webhook target: `https://flow.autoviseo.cloud/webhook/openwa-incoming`

## Files
- Compose override: `docker-compose.vps.yml`
- Env template: `.env.vps.example`

## First deployment commands
```bash
# 1) Clone (or pull update)
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
# or if already cloned:
# git pull --ff-only

# 2) Prepare env
cp .env.vps.example .env.vps
# Edit secrets and placeholders in .env.vps

# 3) Validate compose config
docker compose --env-file .env.vps -f docker-compose.yml -f docker-compose.vps.yml config

# 4) Build
docker compose --env-file .env.vps -f docker-compose.yml -f docker-compose.vps.yml build

# 5) Start
docker compose --env-file .env.vps -f docker-compose.yml -f docker-compose.vps.yml up -d

# 6) Check logs
docker compose --env-file .env.vps -f docker-compose.yml -f docker-compose.vps.yml logs -f --tail=200
```

## Must-fill variables in `.env.vps`
- `DASHBOARD_BASIC_AUTH_USERS`
- `DATABASE_PASSWORD`
- `REDIS_PASSWORD` (if Redis enabled)
- `TRAEFIK_NETWORK` (if not `traefik-public`)

## VPS verification commands
```bash
# Render final compose
docker compose --env-file .env.vps -f docker-compose.yml -f docker-compose.vps.yml config

# Running containers
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

# API health via domain (should require no API key if endpoint is public health)
curl -i https://openwa-api.autoviseo.com/api/health

# CORS checks
curl -i -H 'Origin: https://openwa-panel.autoviseo.com' https://openwa-api.autoviseo.com/api/health
curl -i -H 'Origin: https://evil.example' https://openwa-api.autoviseo.com/api/health

# Dashboard auth check (expect 401 without credentials)
curl -I https://openwa-panel.autoviseo.com

# Confirm non-root container user
docker exec -it openwa-api id

# Confirm NO docker socket mounted
docker inspect openwa-api --format '{{json .Mounts}}' | jq

# Confirm no plaintext key file in production
docker exec -it openwa-api sh -lc 'test ! -f /app/data/.api-key && echo OK_no_plaintext_key_file'

# Check key leakage in logs
docker compose --env-file .env.vps -f docker-compose.yml -f docker-compose.vps.yml logs openwa-api | grep -Ei 'owa_k1_|dev-admin-key|x-api-key|authorization' || true
```

## Security scans on VPS
```bash
npm audit --omit=dev
npm audit
gitleaks detect --source .
semgrep scan --config auto
trivy fs .
# After image build:
trivy image openwa-openwa-api:latest
```

## Smoke test flow
1. Open dashboard `https://openwa-panel.autoviseo.com` (with Basic Auth + API key login).
2. Create WhatsApp session.
3. Scan QR in WhatsApp mobile app.
4. Send a test message from an external phone to connected number.
5. Confirm webhook delivery in n8n execution logs (`flow.autoviseo.cloud`).
6. Use OpenWA API with `X-API-Key` to send reply message.

## Rollback commands
```bash
# View compose history and choose last good git commit
git log --oneline -n 10

# Roll back code
git checkout <LAST_GOOD_COMMIT>

# Rebuild/restart
docker compose --env-file .env.vps -f docker-compose.yml -f docker-compose.vps.yml build
docker compose --env-file .env.vps -f docker-compose.yml -f docker-compose.vps.yml up -d
```

## Backup notes
- PostgreSQL:
```bash
docker exec -t openwa-postgres pg_dump -U "$DATABASE_USERNAME" "$DATABASE_NAME" > backup_openwa_$(date +%F).sql
```
- WhatsApp session/auth state + media files:
```bash
docker run --rm -v openwa_openwa-data:/data -v "$PWD":/backup alpine \
  sh -c 'cd /data && tar czf /backup/openwa_data_$(date +%F).tgz .'
```

## Final go/no-go checklist
- [ ] DNS for both domains points to VPS.
- [ ] TLS certs active in Traefik for both domains.
- [ ] Dashboard protected (Basic Auth or IP allowlist).
- [ ] `CORS_ORIGINS` and `WS_ALLOWED_ORIGINS` are exact trusted origins.
- [ ] PostgreSQL persistent volume exists and backups scheduled.
- [ ] No DB/Redis/MinIO ports exposed publicly.
- [ ] `docker inspect openwa-api` shows no docker socket mount.
- [ ] `docker exec openwa-api id` confirms non-root user.
- [ ] API logs do not contain plaintext API keys/secrets.
- [ ] Webhook to n8n tested end-to-end.
