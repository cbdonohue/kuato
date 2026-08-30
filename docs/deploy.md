# Deploy

Kuato is a Next.js 16 app. It needs Node.js 20+ and a `SITE_PASSWORD`. There is no database. Rankings work without an LLM key.

## Environment

Set these on the host. Do not commit them.

| Variable | Required | What it does |
| --- | --- | --- |
| `SITE_PASSWORD` | yes | Shared login. Signs the HMAC session cookie. |
| `OPENAI_API_KEY` | no | OpenAI coach |
| `ANTHROPIC_API_KEY` | no | Anthropic coach (used when OpenAI is unset) |
| `AI_MODEL` | no | Override the default model id |

`NODE_ENV=production` makes the session cookie `Secure`. Serve over HTTPS.

## Vercel

The repo already ignores `.vercel/`. From the project root:

```bash
npx vercel
```

In the Vercel project, set `SITE_PASSWORD` (and optional LLM keys) as environment variables. Framework preset: Next.js. Node.js 20.

Serverless filesystems are read-only. `src/lib/cache.ts` writes `.cache/` best-effort and keeps an in-memory copy for the instance, so a cold start refetches Sleeper / FFC / nflverse / news.

## Any Node host

```bash
npm ci
npm run build
npm start
```

Listen on the port the host provides (`PORT`). Point the process at the env vars above. Writable disk is optional; without it, each process refetches upstream data on first use.

## After deploy

1. Open `/login` and sign in with `SITE_PASSWORD`.
2. Load a Sleeper username or mock ID.
3. Confirm the live room polls. Coach actions return 503 until a model key is set.

There is no official hosted URL yet. Set the GitHub repo homepage when you have one.
