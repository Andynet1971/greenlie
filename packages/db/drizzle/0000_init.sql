CREATE TABLE "check_state" (
	"check_id" text PRIMARY KEY NOT NULL,
	"watching_since" timestamp with time zone NOT NULL,
	"announced" text,
	"announced_at" timestamp with time zone,
	"last_ping_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"verdict" text NOT NULL,
	"reason" text NOT NULL,
	"status" integer,
	"latency_ms" integer,
	"volume" integer,
	CONSTRAINT "runs_verdict_check" CHECK ("runs"."verdict" in ('ok', 'unknown', 'slow', 'thin', 'stale', 'down'))
);
--> statement-breakpoint
CREATE INDEX "runs_check_at_idx" ON "runs" USING btree ("check_id","at" DESC NULLS LAST);