import { eq, and } from "drizzle-orm";
import { validateDeckForSave, type DeckInfo } from "@steelmate/engine";
import { getDb } from "@/db/client";
import { decks } from "@/db/schema";
import { AuthError, requireAuthUserId } from "@/lib/auth";
import { getServerCatalog, requireCatalogVersion } from "@/lib/catalog";
import { jsonWithCors, preflight } from "@/lib/cors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

export async function GET(req: Request, { params }: Params) {
  const origin = req.headers.get("origin");
  const { id } = await params;
  try {
    const userId = await requireAuthUserId();
    const db = getDb();
    const [row] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.userId, userId)))
      .limit(1);
    if (!row) {
      return jsonWithCors({ error: "Not found" }, { status: 404, origin });
    }
    return jsonWithCors(
      {
        deck: {
          id: row.id,
          name: row.name,
          cardIds: row.cardIds,
          defaultEquippedBySlot: row.defaultEquippedBySlot,
          catalogVersion: row.catalogVersion,
        },
      },
      { origin },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonWithCors({ error: e.message }, { status: e.status, origin });
    }
    return jsonWithCors(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500, origin },
    );
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const origin = req.headers.get("origin");
  const { id } = await params;
  try {
    const userId = await requireAuthUserId();
    const body = (await req.json()) as {
      name?: string;
      cardIds?: string[];
      defaultEquippedBySlot?: DeckInfo["defaultEquippedBySlot"];
    };
    const db = getDb();
    const [existing] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.userId, userId)))
      .limit(1);
    if (!existing) {
      return jsonWithCors({ error: "Not found" }, { status: 404, origin });
    }
    const catalogVersion = requireCatalogVersion();
    const { cards } = getServerCatalog();
    const draft: DeckInfo = {
      id: existing.id,
      name: body.name?.trim() ?? existing.name,
      cardIds: body.cardIds ?? existing.cardIds,
      defaultEquippedBySlot:
        body.defaultEquippedBySlot ?? existing.defaultEquippedBySlot,
    };
    const issues = validateDeckForSave(draft, cards);
    if (issues.some((i) => i.level === "error")) {
      return jsonWithCors(
        {
          error: issues
            .filter((i) => i.level === "error")
            .map((i) => i.message)
            .join("; "),
          issues,
        },
        { status: 400, origin },
      );
    }
    const [row] = await db
      .update(decks)
      .set({
        name: draft.name,
        cardIds: draft.cardIds,
        defaultEquippedBySlot: draft.defaultEquippedBySlot ?? {},
        catalogVersion,
        updatedAt: new Date(),
      })
      .where(eq(decks.id, id))
      .returning();
    return jsonWithCors(
      {
        deck: {
          id: row!.id,
          name: row!.name,
          cardIds: row!.cardIds,
          defaultEquippedBySlot: row!.defaultEquippedBySlot,
          catalogVersion: row!.catalogVersion,
        },
      },
      { origin },
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonWithCors({ error: e.message }, { status: e.status, origin });
    }
    return jsonWithCors(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500, origin },
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const origin = req.headers.get("origin");
  const { id } = await params;
  try {
    const userId = await requireAuthUserId();
    const db = getDb();
    const result = await db
      .delete(decks)
      .where(and(eq(decks.id, id), eq(decks.userId, userId)))
      .returning({ id: decks.id });
    if (result.length === 0) {
      return jsonWithCors({ error: "Not found" }, { status: 404, origin });
    }
    return jsonWithCors({ ok: true }, { origin });
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonWithCors({ error: e.message }, { status: e.status, origin });
    }
    return jsonWithCors(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500, origin },
    );
  }
}
