const DNS_HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function getTurnstileConfig() {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const hosts = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '').split(',').map((host) => host.trim().toLowerCase());
  const localDevelopment = process.env.NODE_ENV !== 'production' && !process.env.VERCEL_ENV;
  const validHost = (host: string) => {
    if (host === 'localhost' || host === '127.0.0.1') return localDevelopment;
    return host.length <= 253 && DNS_HOST.test(host) && !host.endsWith('.localhost');
  };
  if (!secret || !hosts.every(validHost)) return undefined;
  return { secret, hosts };
}
