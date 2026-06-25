// ─── OJT Scout — BaseCache (abstract) ────────────────────────────
// Abstraction pillar: contract for every cache tier.
// Concrete caches (MemoryCache, SessionCache, …) extend this.

export class BaseCache {
  // Subclasses MUST implement.
  async get(key) {
    throw new Error('Subclass must implement get(key)')
  }
  async set(key, value, ttlDays) {
    throw new Error('Subclass must implement set(key, value, ttlDays)')
  }
  async invalidate(key) {
    throw new Error('Subclass must implement invalidate(key)')
  }

  // Shared utility — is a stored timestamp older than its TTL?
  isExpired(timestamp, ttlDays) {
    const age = Date.now() - new Date(timestamp).getTime()
    return age > ttlDays * 24 * 60 * 60 * 1000
  }
}
