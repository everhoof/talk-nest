# Everhoof Instant Messaging System API
> API for Everhoof Instant Messaging system

## Requirements

* Node.js 24.22.0 LTS

## Build Setup

Use `nvm install && nvm use`, then `corepack enable && corepack install` to use
the pinned Node.js and pnpm versions.

#### Clone the repo and install the dependencies.

```bash
git clone --single-branch -b dist https://github.com/everhoof/im_everhoof_api.git
cd im_everhoof_api
```

```bash
pnpm install --frozen-lockfile
```

#### Update configs.

```bash
cp .env .env.local
nano .env.local
```

#### Run migrations.

```bash
pnpm typeorm migration:run
```

```bash
pnpm seeder migration:run
```

#### Before commit and push run:
```bash
$ pnpm format
$ pnpm lint
```

## Development and verification

```bash
pnpm start:dev
pnpm build
pnpm lint
pnpm test --runInBand
```

Integration tests require a disposable PostgreSQL database whose name ends in
`_test`. They reset its schema, run the real migrations and seeds, and test
registration, authentication, messages, pictures, polls, multipart uploads, and
WebSocket subscriptions. Email and DonationAlerts are mocked.

```bash
TEST_DATABASE_URL=postgres://user:password@localhost:5432/talk_test pnpm test:e2e --runInBand
```

The API uses NestJS 12 with Apollo Server 5 and TypeORM 0.3. Database CLI commands
load `src/database/data-source.ts` or `src/database/seed-data-source.ts`; their
production counterparts load the compiled files in `dist/database`. Database
synchronization remains disabled; the existing migrations and seed history are
preserved.

Existing chat clients keep using the `subscriptions-transport-ws` protocol at
`/graphql`. A lifecycle-managed adapter preserves that protocol because NestJS 12
no longer installs it. GraphQL errors retain `extensions.exception.response` for
client notifications and authentication handling.

## Prepare for deployment

### Create folders for app
```bash
$ mkdir -p /path/to/production/folder
$ mkdir -p /path/to/staging/folder
```

### Create and fill .env.local files
```bash
$ nano /path/to/production/folder/.env.local
$ nano /path/to/production/folder/.env.local
```

### Create Secrets in GitHub Actions:
#### For staging
- `STAGING_SSH_HOST=127.0.0.1`
- `STAGING_SSH_PORT=22`
- `STAGING_SSH_USER=root`
- `STAGING_SSH_KEY=...`
- `STAGING_APP_DIR=/path/to/staging/folder`
- `STAGING_NODE_ENV=production`

#### For production
- `PRODUCTION_SSH_HOST=127.0.0.1`
- `PRODUCTION_SSH_PORT=22`
- `PRODUCTION_SSH_USER=root`
- `PRODUCTION_SSH_KEY=...`
- `PRODUCTION_APP_DIR=/path/to/production/folder`
- `PRODUCTION_NODE_ENV=production`

### Manual run on server (optional)
```bash
$ cd $APP_DIR
$ export NODE_ENV=production
$ pm2 start
```
