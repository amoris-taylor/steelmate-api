import { eq } from "drizzle-orm";
import {
  legalActions,
  projectGameStateForPlayer,
} from "@steelmate/engine";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { AuthError, requireAuthUserId } from "@/lib/auth";
import { jsonWithCors, preflight } from "@/lib/cors";
import {
  loadMatchPayload,
  playerIdForUser,
  saveMatchPayload,
} from "@/lib/redis/match";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

export async function GET(req: Request, { params }: Params) {
  const origin = req.headers.get("origin");
  const { id } = await params;
  const url = new URL(req.url);
  const sinceVersion = url.searchParams.get("sinceVersion");
  try {
    const userId = await requireAuthUserId();
    const db = getDb();
    const [matchRow] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);
    if (!matchRow) {
      return jsonWithCors({ error: "Not found" }, { status: 404, origin });
    }
    if (
      matchRow.player0UserId !== userId &&
      matchRow.player1UserId !== userId
    ) {
      return jsonWithCors({ error: "Forbidden" }, { status: 403, origin });
    }

    if (matchRow.status === "waiting") {
      return jsonWithCors(
        {
          status: matchRow.status,
          inviteCode: matchRow.inviteCode,
          version: 0,
        },
        { origin },
      );
    }

    const payload = await loadMatchPayload(id);
    if (!payload) {
      return jsonWithCors(
        { error: "Active state unavailable" },
        { status: 503, origin },
      );
    }

    const playerId = playerIdForUser(payload, userId);
    if (playerId === null) {
      return jsonWithCors({ error: "Forbidden" }, { status: 403, origin });
    }

    if (sinceVersion !== null && Number(sinceVersion) === payload.version) {
      return jsonWithCors({ unchanged: true, version: payload.version }, { origin });
    }

    const projected = projectGameStateForPlayer(payload.state, playerId);
    const actor =
      payload.state.respondingPlayerId ?? payload.state.activePlayer;
    const legal =
      actor === playerId ? legalActions(payload.state) : [];

    const eventsFrom = payload.eventCursor;
    const eventsDelta = payload.state.events.slice(eventsFrom);

    return jsonWithCors(
      {
        status: matchRow.status,
        version: payload.version,
        winner: payload.state.winner,
        you: projected,
        legalActions: legal,
        eventsDelta,
        playerId,
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

export async function POST(req: Request, { params }: Params) {
  return jsonWithCors(
    { error: "Use POST /api/v1/matches/[id]/actions" },
    { status: 405, origin: req.headers.get("origin") },
  );
}
