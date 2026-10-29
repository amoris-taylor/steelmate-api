import { eq, and } from "drizzle-orm";
import { createGame } from "@steelmate/engine";
import { getDb } from "@/db/client";
import { decks, matches, users } from "@/db/schema";
import { AuthError, requireAuthUserId } from "@/lib/auth";
import { getServerCatalog, requireCatalogVersion } from "@/lib/catalog";
import { jsonWithCors, preflight } from "@/lib/cors";
import { saveMatchPayload } from "@/lib/redis/match";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  try {
    const userId = await requireAuthUserId();
    const body = (await req.json()) as {
      inviteCode?: string;
      deckId?: string;
    };
    if (!body.inviteCode?.trim() || !body.deckId) {
      return jsonWithCors(
        { error: "inviteCode and deckId required" },
        { status: 400, origin },
      );
    }
    const catalogVersion = requireCatalogVersion();
    const db = getDb();
    const [matchRow] = await db
      .select()
      .from(matches)
      .where(eq(matches.inviteCode, body.inviteCode.trim().toUpperCase()))
      .limit(1);
    if (!matchRow || matchRow.status !== "waiting") {
      return jsonWithCors(
        { error: "Invite not found or already started" },
        { status: 404, origin },
      );
    }
    if (matchRow.player0UserId === userId) {
      return jsonWithCors(
        { error: "Cannot join your own match" },
        { status: 400, origin },
      );
    }
    const [deck1] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, body.deckId), eq(decks.userId, userId)))
      .limit(1);
    if (!deck1) {
      return jsonWithCors({ error: "Deck not found" }, { status: 404, origin });
    }
    if (deck1.catalogVersion !== catalogVersion) {
      return jsonWithCors(
        { error: "Deck catalog version outdated; re-save deck" },
        { status: 400, origin },
      );
    }
    const [deck0] = await db
      .select()
      .from(decks)
      .where(eq(decks.id, matchRow.deck0Id))
      .limit(1);
    if (!deck0) {
      return jsonWithCors({ error: "Host deck missing" }, { status: 500, origin });
    }

    const [hostUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, matchRow.player0UserId))
      .limit(1);
    const [guestUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    const { cardMap, equipmentTypes } = getServerCatalog();
    const state = createGame({
      decks: [deck0.cardIds, deck1.cardIds],
      defaultEquippedBySlot: [
        deck0.defaultEquippedBySlot ?? {},
        deck1.defaultEquippedBySlot ?? {},
      ],
      cards: cardMap,
      equipmentTypes,
      seed: matchRow.seed,
      mode: "hotseat",
      names: [
        hostUser?.displayName ?? "Player 1",
        guestUser?.displayName ?? "Player 2",
      ],
    });

    const payload = {
      state,
      version: 1,
      playerRoles: { 0: matchRow.player0UserId, 1: userId } as {
        0: string;
        1: string;
      },
      eventCursor: state.events.length,
    };
    await saveMatchPayload(matchRow.id, payload);

    const [updated] = await db
      .update(matches)
      .set({
        status: "active",
        player1UserId: userId,
        deck1Id: deck1.id,
      })
      .where(eq(matches.id, matchRow.id))
      .returning();

    return jsonWithCors(
      {
        match: {
          id: updated!.id,
          status: updated!.status,
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
