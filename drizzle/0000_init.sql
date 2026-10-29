CREATE TABLE IF NOT EXISTS "users" (
  "clerk_id" text PRIMARY KEY NOT NULL,
  "display_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "decks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("clerk_id"),
  "name" text NOT NULL,
  "card_ids" jsonb NOT NULL,
  "default_equipped_by_slot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "catalog_version" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invite_code" text NOT NULL UNIQUE,
  "status" text NOT NULL,
  "catalog_version" text NOT NULL,
  "seed" integer NOT NULL,
  "player0_user_id" text NOT NULL REFERENCES "users"("clerk_id"),
  "player1_user_id" text REFERENCES "users"("clerk_id"),
  "deck0_id" uuid NOT NULL REFERENCES "decks"("id"),
  "deck1_id" uuid REFERENCES "decks"("id"),
  "winner" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "match_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "matches"("id"),
  "seq" integer NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("clerk_id"),
  "action" jsonb NOT NULL,
  "state_version" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "match_actions_match_id_seq" ON "match_actions" ("match_id", "seq");
