const UNKNOWN = 'unknown';

function allowedAncestor(source, siteOrigin, targetOrigin) {
  const value = source.toLowerCase();
  if (value === "'self'") return siteOrigin === targetOrigin;
  if (value === '*') return true;
  if (value === "'none'") return false;
  if (value.endsWith(':') && !value.includes('/')) return new URL(siteOrigin).protocol === value;
  try {
    const candidate = new URL(value.includes('://') ? value : `https://${value}`);
    const site = new URL(siteOrigin);
    if (candidate.protocol !== site.protocol) return false;
    if (candidate.port && candidate.port !== site.port) return false;
    return candidate.hostname === site.hostname || (candidate.hostname.startsWith('*.') && site.hostname.endsWith(candidate.hostname.slice(1)));
  } catch { return false; }
}

export function assessEmbedding(headers, targetURL, siteOrigin) {
  const csp = headers.get('content-security-policy') || '';
  const xfo = (headers.get('x-frame-options') || '').trim().toLowerCase();
  const policies = csp.split(',').flatMap((policy) => policy.split(';')).map((part) => part.trim()).filter((part) => /^frame-ancestors(?:\s|$)/i.test(part));
  for (const policy of policies) {
    const sources = policy.split(/\s+/).slice(1);
    if (sources.length && !sources.some((source) => allowedAncestor(source, siteOrigin, new URL(targetURL).origin))) return { status: 'blocked', reason: 'CSP frame-ancestors' };
  }
  if (/\bdeny\b/.test(xfo) || (/\bsameorigin\b/.test(xfo) && new URL(targetURL).origin !== siteOrigin)) return { status: 'blocked', reason: 'X-Frame-Options' };
  if (policies.length) return { status: 'allowed', reason: 'CSP permits this origin' };
  if (xfo === 'sameorigin' && new URL(targetURL).origin === siteOrigin) return { status: 'allowed', reason: 'X-Frame-Options permits same origin' };
  if (xfo && xfo !== 'deny') return { status: UNKNOWN, reason: 'Unrecognized frame policy' };
  return { status: UNKNOWN, reason: 'No readable frame policy' };
}

export async function scanWebsiteEmbedding(url, siteOrigin = location.origin) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    let response = await fetch(url, { method: 'HEAD', mode: 'cors', credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: controller.signal });
    if ([405, 501].includes(response.status)) response = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: controller.signal });
    if (!response.ok) return { status: UNKNOWN, reason: `Scan returned HTTP ${response.status}`, checkedAt: Date.now() };
    const result = assessEmbedding(response.headers, response.url || url, siteOrigin);
    return { ...result, checkedAt: Date.now() };
  } catch {
    return { status: UNKNOWN, reason: 'Headers unavailable (CORS, network, or timeout)', checkedAt: Date.now() };
  } finally { clearTimeout(timeout); }
}
