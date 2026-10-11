type Settings = Record<string, string | undefined>;

export function localDemoBypassAllowed(
  host: string | null,
  settings: Settings = process.env,
) {
  if (
    settings.LOCAL_DEMO_BYPASS !== "true" ||
    settings.APP_MODE !== "demo" ||
    settings.NODE_ENV !== "development" ||
    settings.RENDER ||
    settings.RENDER_EXTERNAL_URL ||
    settings.VERCEL ||
    settings.CODESPACES
  )
    return false;
  // Não confia em X-Forwarded-Host. O launcher também vincula o servidor ao loopback.
  return !!host && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host);
}
