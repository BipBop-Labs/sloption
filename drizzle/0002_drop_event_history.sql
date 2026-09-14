-- Sin historial: el evento viaja dentro de su entrega y se borra al entregarse.
ALTER TABLE "deliveries" ADD COLUMN "payload" jsonb;--> statement-breakpoint
UPDATE "deliveries" SET "payload" = "events"."payload" FROM "events" WHERE "events"."sequence" = "deliveries"."event_sequence";--> statement-breakpoint
DELETE FROM "deliveries" WHERE "payload" IS NULL OR "status" IN ('delivered', 'cancelled');--> statement-breakpoint
ALTER TABLE "deliveries" ALTER COLUMN "payload" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" DROP COLUMN "event_sequence";--> statement-breakpoint
DROP TABLE "events";
