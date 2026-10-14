"use client";

// Compatibility wrapper: local identity is owned exclusively by the server.
export function FingerprintProvider({ children }: { children: React.ReactNode }) {
  return children;
}
