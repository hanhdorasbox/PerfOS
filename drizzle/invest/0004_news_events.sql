CREATE TABLE "finance_os"."news_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"external_id" text NOT NULL,
	"headline" text NOT NULL,
	"url" text,
	"source" text,
	"summary" text,
	"published_at" timestamp with time zone,
	"significant" boolean DEFAULT false NOT NULL,
	"impact" text,
	"reason" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "news_events_asset_external_unique" UNIQUE("asset_id","external_id")
);
--> statement-breakpoint
ALTER TABLE "finance_os"."news_events" ADD CONSTRAINT "news_events_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "finance_os"."assets"("id") ON DELETE cascade ON UPDATE no action;