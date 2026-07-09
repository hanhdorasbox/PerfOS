CREATE TABLE "finance_os"."t212_instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"t212_ticker" text NOT NULL,
	"name" text,
	"short_name" text,
	"isin" text,
	"currency" text,
	"type" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "t212_instruments_t212_ticker_unique" UNIQUE("t212_ticker")
);
--> statement-breakpoint
ALTER TABLE "finance_os"."sync_runs" ADD COLUMN "warnings" jsonb;