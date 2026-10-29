import { eq } from "drizzle-orm";
import { validateDeckForSave, type DeckInfo } from "@steelmate/engine";
import { getDb } from "@/db/client";
import { decks } from "@/db/schema";
import { AuthError, requireAuthUserId } from "@/lib/auth";
import { getServerCatalog, requireCatalogVersion } from "@/lib/catalog";
import { jsonWithCors, preflight } from "@/lib/cors";

export const runtime = "nodejs";

function deckToInfo(row: typeof decks.$inferSelect): DeckInfo & {
  catalogVersion: string;
} {
  return {
    id: row.id,
    name: row.name,
    cardIds: row.cardIds,
    defaultEquippedBySlot: row.defaultEquippedBySlot,
    catalogVersion: row.catalogVersion,
  };
}

export async function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  try {
    const userId = await requireAuthUserId();
    const db = getDb();
    const rows = await db
      .select()
      .from(decks)
      .where(eq(decks.userId, userId));
    return jsonWithCors(
      {
        decks: rows.map((r) => ({
          ...deckToInfo(r),
          updatedAt: r.updatedAt,
        })),
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

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  try {
    const userId = await requireAuthUserId();
    const body = (await req.json()) as {
      name?: string;
      cardIds?: string[];
      defaultEquippedBySlot?: DeckInfo["defaultEquippedBySlot"];
    };
    if (!body.name?.trim() || !Array.isArray(body.cardIds)) {
      return jsonWithCors(
        { error: "name and cardIds are required" },
        { status: 400, origin },
      );
    }
    const catalogVersion = requireCatalogVersion();
    const { cards } = getServerCatalog();
    const draft: DeckInfo = {
      id: "draft",
      name: body.name.trim(),
      cardIds: body.cardIds,
      defaultEquippedBySlot: body.defaultEquippedBySlot ?? {},
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
    const db = getDb();
    const [row] = await db
      .insert(decks)
      .values({
        userId,
        name: draft.name,
        cardIds: draft.cardIds,
        defaultEquippedBySlot: draft.defaultEquippedBySlot ?? {},
        catalogVersion,
      })
      .returning();
    return jsonWithCors({ deck: deckToInfo(row!) }, { status: 201, origin });
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

export async function PATCH(req: Request) {
  return jsonWithCors(
    { error: "Use PATCH /api/v1/decks/[id]" },
    { status: 405, origin: req.headers.get("origin") },
  );
}

export async function DELETE(req: Request) {
  return jsonWithCors(
    { error: "Use DELETE /api/v1/decks/[id]" },
    { status: 405, origin: req.headers.get("origin") },
  );
}
