const CURSOR_CLOUD_DEV_ORIGIN = "23.21.247.220";

function optional(value: string | undefined): string[] {
  return value ? [value] : [];
}

/** Host GitHub Codespaces uses for the forwarded preview of port 3000. */
export function codespacePreviewHost(
  env: NodeJS.Dict<string> = process.env,
): string | undefined {
  const name = env.CODESPACE_NAME;
  const domain = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (!name || !domain) return undefined;
  return `${name}-3000.${domain}`;
}

/** Origins that may invoke Server Actions when Host / X-Forwarded-Host disagree. */
export function serverActionAllowedOrigins(
  env: NodeJS.Dict<string> = process.env,
): string[] {
  return [
    "localhost:3000",
    "127.0.0.1:3000",
    "*.app.github.dev",
    ...optional(codespacePreviewHost(env)),
  ];
}

/** Extra hosts allowed to talk to `next dev` (Cursor Cloud + Codespaces). */
export function allowedDevOrigins(
  env: NodeJS.Dict<string> = process.env,
): string[] {
  return [
    CURSOR_CLOUD_DEV_ORIGIN,
    "*.app.github.dev",
    ...optional(codespacePreviewHost(env)),
  ];
}
