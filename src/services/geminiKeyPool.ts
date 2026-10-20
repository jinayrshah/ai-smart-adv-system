import { GoogleGenAI } from "@google/genai";

const DEFAULT_POOL_KEYS = [
  "AQ.Ab8RN6KkG6UFzMjZEIg28ybBkc-kunZkJ9Pf6T1YESodSjKFXg",
  "AQ.Ab8RN6JO1AvD7YvBVr9FSPKc_-n-iaF02wnoGoVK82qcTOHgig",
  "AQ.Ab8RN6IOY-1ZBebE-_KUO7f6co7ImG0rVSbEW9p3ShjMmk5FTw",
  "AQ.Ab8RN6Itq91CUuSYH5m9dBLxXuHMXxk1pUY-qfE69sk4hHH3jw",
  "AQ.Ab8RN6JFzFYYbgKSsd0tgcvh-lH8QLHe8hMzdszHuI60EJvTNw",
  "AQ.Ab8RN6Izjp1o_ckVkBrq5pExmjnfmT3U9qeDnOFsKQ6KfAg7OA",
];

class GeminiKeyPoolManager {
  private keys: string[] = [];
  private currentIndex = 0;
  private cooldowns: Map<string, number> = new Map();
  private clients: Map<string, GoogleGenAI> = new Map();

  constructor() {
    this.refreshKeys();
  }

  private refreshKeys() {
    const envKeysStr =
      (import.meta.env?.VITE_GEMINI_API_KEYS as string) ||
      (import.meta.env?.VITE_GEMINI_API_KEY as string) ||
      "";

    const parsed = envKeysStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const merged = Array.from(new Set([...parsed, ...DEFAULT_POOL_KEYS]));
    this.keys = merged;
  }

  public markRateLimited(key: string, durationMs: number = 60000) {
    this.cooldowns.set(key, Date.now() + durationMs);
    console.warn(`[GeminiKeyPool] Key ...${key.slice(-6)} rate-limited (429). Rotating to next pooled key.`);
  }

  public getOrderedKeys(): string[] {
    if (this.keys.length === 0) {
      this.refreshKeys();
    }
    const now = Date.now();
    const active = this.keys.filter((k) => (this.cooldowns.get(k) || 0) <= now);
    const pool = active.length > 0 ? active : [...this.keys].sort((a, b) => (this.cooldowns.get(a) || 0) - (this.cooldowns.get(b) || 0));

    const start = this.currentIndex % pool.length;
    this.currentIndex = (this.currentIndex + 1) % pool.length;
    return [...pool.slice(start), ...pool.slice(0, start)];
  }

  public getClient(key: string): GoogleGenAI {
    let client = this.clients.get(key);
    if (!client) {
      client = new GoogleGenAI({ apiKey: key });
      this.clients.set(key, client);
    }
    return client;
  }

  /**
   * Automatically executes an operation across pooled keys.
   * If a key throws a 429 / RESOURCE_EXHAUSTED error, it marks it on cooldown and rotates to the next key.
   */
  public async executeWithRotation<T>(
    operation: (client: GoogleGenAI, key: string) => Promise<T>
  ): Promise<T> {
    const keys = this.getOrderedKeys();
    let lastError: any = null;

    for (const key of keys) {
      try {
        const client = this.getClient(key);
        return await operation(client, key);
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err || "");
        const isRateLimit =
          err?.status === "RESOURCE_EXHAUSTED" ||
          err?.code === 429 ||
          err?.error?.code === 429 ||
          msg.includes("429") ||
          msg.includes("quota") ||
          msg.includes("RESOURCE_EXHAUSTED");

        if (isRateLimit) {
          this.markRateLimited(key, 60000);
          continue; // seamlessly try next key in pool
        }
        this.markRateLimited(key, 30000);
        console.warn(`[GeminiKeyPool] Key ...${key.slice(-6)} failed:`, msg);
      }
    }

    throw lastError || new Error("All Gemini API keys in pool failed.");
  }
}

export const geminiKeyPool = new GeminiKeyPoolManager();
