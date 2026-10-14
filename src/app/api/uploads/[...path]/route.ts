import { withStorageErrors } from "@/lib/media-path";
import { mediaPath, mediaSegment } from "@/lib/media-path";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const uploadDir = process.env.UPLOAD_DIR || "./uploads";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  segments.forEach(mediaSegment);
  const resolved = mediaPath(path.join(uploadDir, ...segments));

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const buffer = fs.readFileSync(resolved);

  return new NextResponse(buffer, {
    headers: { "Content-Type": contentType },
  });
}

export const GET = withStorageErrors(handleGET);
