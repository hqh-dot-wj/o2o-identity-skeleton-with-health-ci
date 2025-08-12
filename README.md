# o2o-identity-skeleton

A minimal **NestJS + Prisma + MySQL + Redis** skeleton for **multi-identity login** (consumer / merchant / worker),
designed to scale to multi-tenant, multi-database O2O scenarios.

## Quick Start

```bash
pnpm i
docker compose up -d   # MySQL + Redis
cp .env.example .env
pnpm -C apps/api prisma:generate
pnpm -C apps/api prisma:migrate:dev
pnpm -C apps/api seed
pnpm -C apps/api dev
```

### Default seed user
- email: `admin@example.com`
- phone: `18800000000`
- password: `Passw0rd!`
- identities: CONSUMER, MERCHANT(under demo tenant), WORKER

### SMS
To enable sending login codes via Aliyun, configure environment variables:
- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_SMS_SIGN`
- `ALIYUN_SMS_TEMPLATE`

### API
- `POST /auth/sms { phone }`
- `POST /auth/login { phone, password?, code?, identityId?, tenantId? }`
- `POST /auth/login/wechat { code }`
- `POST /auth/refresh { refreshToken }`
- `POST /auth/switch-identity { identityId, tenantId? }` (requires Authorization Bearer)
- `GET /me` (requires Authorization Bearer)

### Health
- `GET /health/liveness` → lightweight liveness
- `GET /health` → readiness check (MySQL + Redis)

## Push to GitHub

1. Create a new GitHub repo (e.g. `o2o-identity-skeleton`)
2. Run:
```bash
git init
git add .
git commit -m "feat: initial scaffold (nest + prisma multi-identity + health + ci)"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/o2o-identity-skeleton.git
git push -u origin main
```

Or with GitHub CLI:
```bash
gh repo create o2o-identity-skeleton --public --source=. --remote=origin --push
```

## Notes
- Access token TTL = 15m. Refresh tokens are stored in Redis for 14 days and can be revoked.
- This is intentionally a **single service**. Breaking out microservices later won't require auth rewrites.
