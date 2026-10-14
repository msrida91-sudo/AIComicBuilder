import { mediaPath, StoragePathError } from "@/lib/media-path";
import { serverProviderConfig, mediaFetch, providerTransport } from "@/lib/provider-security";
import OpenAI from "openai";
import type { AIProvider, TextOptions, ImageOptions } from "../types";
import fs from "node:fs";
import path from "node:path";
import { id as genId } from "@/lib/id";

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private defaultModel: string;
  private uploadDir: string;

  constructor(params?: { apiKey?: string; baseURL?: string; model?: string; uploadDir?: string; }) {
    const secure = serverProviderConfig({ protocol: "openai", baseUrl: params?.baseURL });
    params = { ...params, baseURL: secure.baseUrl, apiKey: secure.apiKey };
    this.client = new OpenAI({
      apiKey: params?.apiKey || process.env.OPENAI_API_KEY,
      baseURL: params?.baseURL || process.env.OPENAI_BASE_URL,
      fetch: providerTransport("openai"),
      maxRetries: 0,
    });
    this.defaultModel = params?.model || process.env.OPENAI_MODEL || "gpt-4o";
    this.uploadDir = params?.uploadDir || process.env.UPLOAD_DIR || "./uploads";
  }

  async generateText(prompt: string, options?: TextOptions): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    if (options?.images?.length) {
      const content: OpenAI.Chat.ChatCompletionContentPart[] = [];
      for (const imgPath of options.images) {
        try {
          const resolved = mediaPath(imgPath);
          if (fs.existsSync(resolved)) {
            const data = fs.readFileSync(resolved).toString("base64");
            const ext = path.extname(resolved).toLowerCase();
            const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
            content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } });
          }
        } catch (error) {
          if (error instanceof StoragePathError) throw error;
        }
      }
      content.push({ type: "text", text: prompt });
      messages.push({ role: "user", content });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const response = await this.client.chat.completions.create({
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    });
    return response.choices[0]?.message?.content || "";
  }

  async generateImage(prompt: string, options?: ImageOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const isDallE = model.startsWith("dall-e");

    // Build extra params for non-DALL-E OpenAI-compatible providers (e.g. seedream, doubao).
    // These APIs typically accept `size` as "WxH" and/or `aspect_ratio` as "W:H".
    const compatParams: Record<string, unknown> = {};
    if (!isDallE) {
      if (options?.size) compatParams.size = options.size;
      if (options?.aspectRatio) compatParams.aspect_ratio = options.aspectRatio;
      if (!options?.size && !options?.aspectRatio) compatParams.aspect_ratio = "16:9";
    }

    const response = await ((this.client.images.generate as unknown) as (params: Record<string, unknown>) => Promise<OpenAI.ImagesResponse>)({
      model,
      prompt,
      ...(isDallE && {
        size: (["1024x1024", "1792x1024", "1024x1792"].includes(options?.size ?? "")
          ? options!.size
          : "1792x1024") as "1024x1024" | "1792x1024" | "1024x1792",
        quality: (options?.quality as "standard" | "hd") || "standard",
      }),
      ...compatParams,
      n: 1,
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned from OpenAI");

    const imageResponse = await mediaFetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const filename = `${genId()}.png`;
    const dir = mediaPath(path.join(this.uploadDir, "frames"), "directory");
    fs.mkdirSync(dir, { recursive: true });
    const filepath = mediaPath(path.join(dir, filename), "write");
    fs.writeFileSync(filepath, buffer);

    return filepath;
  }
}
