import type { agents, tasks } from "@/lib/db/schema";

/** Explicit response allowlists. Never return credential-bearing rows/payloads. */
export function publicAgent(row: typeof agents.$inferSelect) {
  return {
    id: row.id, name: row.name, platform: row.platform, category: row.category,
    appId: row.appId, description: row.description,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export function publicTask(row: typeof tasks.$inferSelect) {
  return {
    id: row.id, projectId: row.projectId, episodeId: row.episodeId, type: row.type,
    status: row.status, retries: row.retries, maxRetries: row.maxRetries,
    createdAt: row.createdAt, scheduledAt: row.scheduledAt,
    error: row.error ? "Task failed; check the local server" : null,
  };
}

/** Do not persist client-supplied credentials inside job payloads. */
export function withoutCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutCredentials);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) =>
      !/api.?key|secret|token|password|authorization|credential/i.test(key)
    ).map(([key, item]) => [key, withoutCredentials(item)]));
  }
  return value;
}
