CREATE SCHEMA "finance_os";
--> statement-breakpoint
CREATE TYPE "finance_os"."alert_type" AS ENUM('price_vs_fair_value', 'position_weight', 'drawdown_from_peak', 'pe_percentile', 'cash_below', 'analysis_stale');--> statement-breakpoint
CREATE TYPE "finance_os"."analysis_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "finance_os"."data_source" AS ENUM('manual', 't212');--> statement-breakpoint
CREATE TYPE "finance_os"."position_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "finance_os"."transaction_type" AS ENUM('buy', 'sell', 'dividend', 'deposit', 'withdrawal', 'fee');--> statement-breakpoint
CREATE TABLE "finance_os"."alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"notified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_os"."alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "finance_os"."alert_type" NOT NULL,
	"params" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"cooldown_hours" integer DEFAULT 72 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_os"."analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "finance_os"."analysis_status" DEFAULT 'draft' NOT NULL,
	"fair_value" numeric,
	"margin_of_safety" numeric,
	"qualitative_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_os"."analysis_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"field" text NOT NULL,
	"fetched_value" numeric,
	"manual_value" numeric,
	"source" text NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_inputs_analysis_field_unique" UNIQUE("analysis_id","field")
);
--> statement-breakpoint
CREATE TABLE "finance_os"."assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"exchange" text,
	"sector" text,
	"manual_pricing" boolean DEFAULT false NOT NULL,
	"t212_ticker" text,
	"needs_mapping" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_ticker_unique" UNIQUE("ticker"),
	CONSTRAINT "assets_t212_ticker_unique" UNIQUE("t212_ticker")
);
--> statement-breakpoint
CREATE TABLE "finance_os"."cash_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric NOT NULL,
	"source" "finance_os"."data_source" DEFAULT 'manual' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_os"."cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "finance_os"."fundamentals_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_os"."fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" text NOT NULL,
	"rate_to_czk" numeric NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "fx_rates_currency_date_unique" UNIQUE("currency","date")
);
--> statement-breakpoint
CREATE TABLE "finance_os"."positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"status" "finance_os"."position_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "finance_os"."price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"price" numeric NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "price_snapshots_asset_date_unique" UNIQUE("asset_id","date")
);
--> statement-breakpoint
CREATE TABLE "finance_os"."sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"orders_imported" integer DEFAULT 0 NOT NULL,
	"dividends_imported" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "finance_os"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" uuid,
	"type" "finance_os"."transaction_type" NOT NULL,
	"quantity" numeric,
	"price" numeric,
	"amount" numeric NOT NULL,
	"currency" text NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"note" text,
	"external_id" text,
	"source" "finance_os"."data_source" DEFAULT 'manual' NOT NULL,
	CONSTRAINT "transactions_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "finance_os"."watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"target_mos" numeric NOT NULL,
	"note" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_items_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
ALTER TABLE "finance_os"."alert_events" ADD CONSTRAINT "alert_events_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "finance_os"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_os"."analyses" ADD CONSTRAINT "analyses_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "finance_os"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_os"."analysis_inputs" ADD CONSTRAINT "analysis_inputs_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "finance_os"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_os"."fundamentals_snapshots" ADD CONSTRAINT "fundamentals_snapshots_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "finance_os"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_os"."positions" ADD CONSTRAINT "positions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "finance_os"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_os"."price_snapshots" ADD CONSTRAINT "price_snapshots_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "finance_os"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_os"."transactions" ADD CONSTRAINT "transactions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "finance_os"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_os"."watchlist_items" ADD CONSTRAINT "watchlist_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "finance_os"."assets"("id") ON DELETE cascade ON UPDATE no action;