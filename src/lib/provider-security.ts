// Server-side only. Browser model configuration contains metadata, never credentials.
const PROVIDERS: Record<string, { url: string; hosts: string[]; key: string; base: string }> = {
  openai: { url: "https://api.openai.com/v1", hosts: ["api.openai.com"], key: "OPENAI_API_KEY", base: "OPENAI_BASE_URL" },
  gemini: { url: "https://generativelanguage.googleapis.com", hosts: ["generativelanguage.googleapis.com"], key: "GEMINI_API_KEY", base: "GEMINI_BASE_URL" },
  seedance: { url: "https://ark.cn-beijing.volces.com/api/v3", hosts: ["ark.cn-beijing.volces.com"], key: "SEEDANCE_API_KEY", base: "SEEDANCE_BASE_URL" },
  "ucloud-seedance": { url: "https://api.modelverse.cn", hosts: ["api.modelverse.cn"], key: "UCLOUD_API_KEY", base: "UCLOUD_BASE_URL" },
  kling: { url: "https://api.klingai.com", hosts: ["api.klingai.com", "api-beijing.klingai.com"], key: "KLING_ACCESS_KEY", base: "KLING_BASE_URL" },
  wan: { url: "https://dashscope.aliyuncs.com/api/v1", hosts: ["dashscope.aliyuncs.com"], key: "WAN_API_KEY", base: "WAN_BASE_URL" },
  dashscope: { url: "https://dashscope.aliyuncs.com/api/v1", hosts: ["dashscope.aliyuncs.com"], key: "DASHSCOPE_API_KEY", base: "DASHSCOPE_BASE_URL" },
  bailian: { url: "https://dashscope.aliyuncs.com", hosts: ["dashscope.aliyuncs.com"], key: "BAILIAN_API_KEY", base: "BAILIAN_BASE_URL" },
  coze: { url: "https://api.coze.cn", hosts: ["api.coze.cn"], key: "COZE_API_KEY", base: "COZE_BASE_URL" },
  dify: { url: "https://api.dify.ai", hosts: ["api.dify.ai"], key: "DIFY_API_KEY", base: "DIFY_BASE_URL" },
};

export function trustedProviderUrl(protocol: string, value: string): string {
  const provider = PROVIDERS[protocol];
  if (!provider) throw new Error("Unsupported provider");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid provider destination"); }
  if (url.username || url.password || url.hash) throw new Error("Invalid provider destination");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const configured = process.env[provider.base];
  // Loopback is opt-in on the server, never selected by a browser request.
  if (loopback && configured) {
    const local = new URL(configured);
    if (local.origin === url.origin && ["http:", "https:"].includes(url.protocol)) return url.toString();
  }
  if (url.protocol !== "https:" || !provider.hosts.includes(url.hostname) ||
      (url.port && url.port !== "443")) throw new Error("Untrusted provider destination");
  return url.toString();
}

export function serverProviderConfig<T extends { protocol: string; baseUrl?: string }>(config: T) {
  const provider = PROVIDERS[config.protocol];
  if (!provider) throw new Error("Unsupported provider");
  // Browser base URLs are validated but cannot override the server destination.
  if (config.baseUrl) trustedProviderUrl(config.protocol, config.baseUrl);
  const baseUrl = trustedProviderUrl(config.protocol, process.env[provider.base] || provider.url).replace(/\/+$/, "");
  const apiKey = process.env[provider.key] ||
    (config.protocol === "gemini" ? process.env.GOOGLE_API_KEY : "") ||
    (config.protocol === "wan" || config.protocol === "bailian" ? process.env.DASHSCOPE_API_KEY : "") || "";
  return { ...config, baseUrl, apiKey, secretKey: config.protocol === "kling" ? process.env.KLING_SECRET_KEY || "" : undefined };
}

export async function providerFetch(protocol: string, input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (!serverProviderConfig({ protocol }).apiKey) throw new Error("Provider credential is not configured on the server");
  const value = input instanceof Request ? input.url : String(input);
  trustedProviderUrl(protocol, value);
  // Never forward credentials across an HTTP redirect, including within SDKs using this transport.
  const response = await fetch(input, { ...init, redirect: "error" });
  if (!response.ok) throw new Error("Provider request failed (" + response.status + ")");
  return response;
}

export function providerTransport(protocol: string): typeof fetch {
  return (input, init) => providerFetch(protocol, input, init);
}

/** Provider-generated media URLs carry no application credentials. */
export async function mediaFetch(value: string): Promise<Response> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid media URL"); }
  if (url.protocol !== "https:" || url.username || url.password ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Invalid media URL");
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error("Media download failed");
  return response;
}

/** Fail closed until this SDK's redirect handling is reviewed in a later milestone. */
export function requireReviewedGenAiTransport(): never {
  throw new Error("Google GenAI image/video SDK is disabled in security-hardening-v1 pending transport review");
}
