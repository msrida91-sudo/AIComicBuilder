import { publicAgent } from "@/lib/safe-responses";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserIdFromRequest } from "@/lib/get-user-id";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = getUserIdFromRequest(request);
  const body = (await request.json()) as Partial<{
    name: string;
    category: string;
    appId: string;
    apiKey: string;
    description: string;
  }>;

  if (body.apiKey) {
    return NextResponse.json({ error: "Configure agent credentials in the server environment" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(agents)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.category !== undefined && { category: body.category as typeof agents.$inferInsert.category }),
      ...(body.appId !== undefined && { appId: body.appId }),
      apiKey: "", // Discard legacy stored credentials on edit.
      ...(body.description !== undefined && { description: body.description }),
      updatedAt: new Date(),
    })
    .where(eq(agents.id, id));

  const [updated] = await db.select().from(agents).where(eq(agents.id, id));
  return NextResponse.json(publicAgent(updated));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = getUserIdFromRequest(request);

  const [existing] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(agents).where(eq(agents.id, id));
  return NextResponse.json({ ok: true });
}
