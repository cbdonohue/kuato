# Security Policy

## Supported versions

Only the `master` branch is supported. There are no versioned releases yet.

## Reporting a vulnerability

Do not open a public GitHub issue for security problems.

Report vulnerabilities privately:

1. Use [GitHub private vulnerability reporting](https://github.com/cbdonohue/kuato/security/advisories/new) if it is enabled on this repository.
2. Otherwise email [christopher.donohue@gmail.com](mailto:christopher.donohue@gmail.com) with a description, impact, and steps to reproduce.

You should hear back within 7 days. Please do not disclose the issue publicly until a fix is released or you are told it is safe to do so.

## What this app stores

Kuato is a password-gated dashboard. It does not store Sleeper credentials and cannot make picks. A shared `SITE_PASSWORD` signs an HMAC session cookie. Optional `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` values are server-side only.

Keep those secrets in the host environment (or `.env.local` locally). Never commit `.env*` files other than `.env.example`.
