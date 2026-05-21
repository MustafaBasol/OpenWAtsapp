import * as dns from 'dns/promises';
import * as net from 'net';

const DEFAULT_MAX_REDIRECT_HOPS = 5;

export async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('Webhook URL must use HTTPS in production');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Webhook URL host is not allowed');
  }

  const records = await dns.lookup(hostname, { all: true });
  for (const rec of records) {
    if (isBlockedAddress(rec.address)) {
      throw new Error('Webhook URL resolves to a blocked IP range');
    }
  }
}

export async function fetchWithSafeRedirects(
  url: string,
  init: RequestInit,
  opts?: { maxRedirectHops?: number },
): Promise<Response> {
  const maxRedirectHops = opts?.maxRedirectHops ?? DEFAULT_MAX_REDIRECT_HOPS;
  let currentUrl = url;

  for (let hop = 0; hop <= maxRedirectHops; hop++) {
    await assertSafeWebhookUrl(currentUrl);

    const response = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
    });

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    if (hop === maxRedirectHops) {
      throw new Error(`Webhook redirect limit exceeded (${maxRedirectHops})`);
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Webhook redirect missing Location header');
    }

    const nextUrl = new URL(location, currentUrl).toString();
    await assertSafeWebhookUrl(nextUrl);
    currentUrl = nextUrl;
  }

  throw new Error('Unreachable redirect state');
}

function isRedirectStatus(statusCode: number): boolean {
  return statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308;
}

function isBlockedAddress(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    if (
      ip.startsWith('10.') ||
      ip.startsWith('127.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('169.254.') ||
      ip.startsWith('0.') ||
      ip === '255.255.255.255'
    )
      return true;
    const p = ip.split('.').map(Number);
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (ip === '100.100.100.200' || ip === '169.254.169.254') return true;
  }

  if (net.isIP(ip) === 6) {
    const n = ip.toLowerCase();
    if (n === '::1' || n.startsWith('fc') || n.startsWith('fd') || n.startsWith('fe80')) return true;
    if (n === '::ffff:169.254.169.254') return true;
  }

  return false;
}
