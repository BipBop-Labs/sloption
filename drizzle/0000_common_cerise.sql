CREATE TABLE "deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"event_sequence" integer NOT NULL,
	"webhook_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"collection" text NOT NULL,
	"id" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "records_collection_id_pk" PRIMARY KEY("collection","id")
);
