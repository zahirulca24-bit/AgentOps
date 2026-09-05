import { promises as dns } from 'dns';
import { AppError } from '../../core/errors.js';

export function isIpBlocked(ip: string): boolean {
  if (!ip) return true;

  // Exact IPv4 loopback & IPv6
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true;

  // IPv4 prefix checks
  if (ip.startsWith('127.')) return true;       // Loopback range 127.0.0.0/8
  if (ip.startsWith('169.254.')) return true;   // Link-local / Cloud metadata 169.254.0.0/16
  if (ip.startsWith('10.')) return true;        // Private 10.0.0.0/8
  if (ip.startsWith('192.168.')) return true;   // Private 192.168.0.0/16
  if (ip.startsWith('0.')) return true;         // Current network

  // Private 172.16.0.0 - 172.31.255.255
  if (ip.startsWith('172.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10);
    if (!isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31) return true;
  }

  // Carrier-grade NAT 100.64.0.0/10 (100.64.0.0 - 100.127.255.255)
  if (ip.startsWith('100.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10);
    if (!isNaN(secondOctet) && secondOctet >= 64 && secondOctet <= 127) return true;
  }

  // IPv6 link-local (fe80::/10) and unique local (fc00::/7)
  const lowerIp = ip.toLowerCase();
  if (lowerIp.startsWith('fe80:') || lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true;

  return false;
}

export async function validateUrlSafe(urlString: string, allowLocalhostForTests: boolean = false): Promise<void> {
  if (!urlString || typeof urlString !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'URL must be a non-empty string', 400);
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid URL format', 400);
  }

  if (urlString === 'about:blank' || (url.protocol === 'about:' && url.pathname === 'blank')) {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('NAVIGATION_BLOCKED', 'Navigation blocked: Unsupported URL scheme', 403);
  }

  const hostname = url.hostname.toLowerCase();

  if (allowLocalhostForTests && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')) {
    return;
  }

  if (hostname === 'localhost') {
    throw new AppError('NAVIGATION_BLOCKED', 'Navigation blocked: Target resolves to a restricted IP address', 403);
  }

  try {
    const lookup = await dns.lookup(hostname);
    if (isIpBlocked(lookup.address)) {
      throw new AppError('NAVIGATION_BLOCKED', 'Navigation blocked: Target resolves to a restricted IP address', 403);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('NAVIGATION_BLOCKED', 'Navigation blocked: Failed to resolve hostname', 403);
  }
}
