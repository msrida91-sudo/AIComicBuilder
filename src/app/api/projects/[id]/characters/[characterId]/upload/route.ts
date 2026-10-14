import { withStorageErrors } from "@/lib/media-path";
import { mediaPath } from "@/lib/media-path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { id as genId } from "@/lib/id";
import { assertProjectOwnership } from "@/lib/assert-project-ownership";

const uploadDir = process.env.UPLOAD_DIR || "./uploads";

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  const { id: projectId, characterId } = await params;
  if (!(await assertProjectOwnership(request, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [character] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, characterId), eq(characters.projectId, projectId)));
  if (!character) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "png";
  const filename = `${genId()}.${ext}`;
  const dir = mediaPath(path.join(uploadDir, "characters"), "directory");
  fs.mkdirSync(dir, { recursive: true });
  const filepath = mediaPath(path.join(dir, filename), "write");
  fs.writeFileSync(filepath, buffer);

  // Append to history
  let history: string[] = [];
  try {
    history = JSON.parse(character.referenceImageHistory || "[]");
  } catch {}
  if (character.referenceImage && !history.includes(character.referenceImage)) {
    history.push(character.referenceImage);
  }
  if (!history.includes(filepath)) {
    history.push(filepath);
  }

  const [updated] = await db
    .update(characters)
    .set({ referenceImage: filepath, referenceImageHistory: JSON.stringify(history) })
    .where(eq(characters.id, characterId))
    .returning();

  return NextResponse.json(updated);
}

export const POST = withStorageErrors(handlePOST);
