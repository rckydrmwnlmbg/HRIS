const globalAny: any = global;

if (!globalAny.apiCache) {
  globalAny.apiCache = new Map<string, { data: any, expiry: number }>();
}

const cache: Map<string, { data: any, expiry: number }> = globalAny.apiCache;

export function getCache<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
}

export function setCache(key: string, data: any, ttlSeconds: number = 60) {
  cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

export function clearCache(keyPrefix?: string) {
  if (!keyPrefix) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        cache.delete(key);
      }
    }
  }
}
