CREATE TABLE "billing_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor_type" varchar(50) NOT NULL,
	"actor_id" varchar(255),
	"changes" jsonb,
	"previous_values" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customer_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"entitlement_key" varchar(100) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"source" varchar(50) NOT NULL,
	"source_id" uuid,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customer_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"limit_key" varchar(100) NOT NULL,
	"max_value" integer NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone,
	"source" varchar(50) NOT NULL,
	"source_id" uuid,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"stripe_customer_id" varchar(255),
	"mp_customer_id" varchar(255),
	"preferred_language" varchar(10) DEFAULT 'en',
	"segment" varchar(50),
	"tier" varchar(20),
	"billing_address" jsonb,
	"shipping_address" jsonb,
	"tax_id" varchar(50),
	"tax_id_type" varchar(20),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_entitlements_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "billing_idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"operation" varchar(100) NOT NULL,
	"request_params" jsonb,
	"response_body" jsonb,
	"status_code" varchar(10),
	"livemode" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_idempotency_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "billing_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"price_id" varchar(255),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"proration" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "billing_invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_applied" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"number" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0,
	"tax" integer DEFAULT 0,
	"total" integer NOT NULL,
	"amount_paid" integer DEFAULT 0,
	"amount_remaining" integer,
	"currency" varchar(3) NOT NULL,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"stripe_invoice_id" varchar(255),
	"mp_invoice_id" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"default_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "billing_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payment_method_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"last_four" varchar(4),
	"brand" varchar(50),
	"exp_month" integer,
	"exp_year" integer,
	"is_default" boolean DEFAULT false,
	"billing_details" jsonb,
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"invoice_id" uuid,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"base_amount" integer,
	"base_currency" varchar(3),
	"exchange_rate" numeric(18, 8),
	"status" varchar(50) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payment_id" varchar(255),
	"payment_method_id" uuid,
	"refunded_amount" integer DEFAULT 0,
	"failure_code" varchar(100),
	"failure_message" text,
	"idempotency_key" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entitlements" text[] DEFAULT '{}' NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"nickname" varchar(255),
	"currency" varchar(3) NOT NULL,
	"unit_amount" integer NOT NULL,
	"billing_interval" varchar(50) NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"trial_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"stripe_price_id" varchar(255),
	"mp_price_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_promo_code_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_code_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"discount_amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"value" integer NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"max_uses" integer,
	"used_count" integer DEFAULT 0,
	"max_per_customer" integer DEFAULT 1,
	"valid_plans" text[],
	"new_customers_only" boolean DEFAULT false,
	"existing_customers_only" boolean DEFAULT false,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"combinable" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "billing_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(50) NOT NULL,
	"reason" varchar(100),
	"provider_refund_id" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan_id" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"billing_interval" varchar(50) NOT NULL,
	"interval_count" integer DEFAULT 1,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"trial_converted" boolean DEFAULT false,
	"trial_converted_at" timestamp with time zone,
	"cancel_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"promo_code_id" uuid,
	"default_payment_method_id" uuid,
	"grace_period_ends_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp with time zone,
	"stripe_subscription_id" varchar(255),
	"mp_subscription_id" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"action" varchar(20) DEFAULT 'increment' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_vendor_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(50) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payout_id" varchar(255),
	"failure_code" varchar(100),
	"failure_message" varchar(500),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"commission_rate" numeric(5, 4) NOT NULL,
	"payment_mode" varchar(50) DEFAULT 'automatic',
	"stripe_account_id" varchar(255),
	"mp_merchant_id" varchar(255),
	"onboarding_status" varchar(50) DEFAULT 'pending',
	"can_receive_payments" boolean DEFAULT false,
	"pending_balance" integer DEFAULT 0,
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "billing_vendors_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_dead_letter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"attempts" integer NOT NULL,
	"resolved_at" timestamp with time zone,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"attempts" integer DEFAULT 0,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_customer_entitlements" ADD CONSTRAINT "billing_customer_entitlements_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customer_limits" ADD CONSTRAINT "billing_customer_limits_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice_lines" ADD CONSTRAINT "billing_invoice_lines_invoice_id_billing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice_payments" ADD CONSTRAINT "billing_invoice_payments_invoice_id_billing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_methods" ADD CONSTRAINT "billing_payment_methods_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_prices" ADD CONSTRAINT "billing_prices_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_promo_code_usage" ADD CONSTRAINT "billing_promo_code_usage_promo_code_id_billing_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."billing_promo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_refunds" ADD CONSTRAINT "billing_refunds_payment_id_billing_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."billing_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_promo_code_id_billing_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."billing_promo_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_usage_records" ADD CONSTRAINT "billing_usage_records_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_vendor_payouts" ADD CONSTRAINT "billing_vendor_payouts_vendor_id_billing_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."billing_vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "billing_audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "billing_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "billing_audit_logs" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "billing_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_customer_entitlements_customer_id" ON "billing_customer_entitlements" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_entitlements_key" ON "billing_customer_entitlements" USING btree ("entitlement_key");--> statement-breakpoint
CREATE INDEX "idx_customer_entitlements_customer_key" ON "billing_customer_entitlements" USING btree ("customer_id","entitlement_key");--> statement-breakpoint
CREATE INDEX "idx_customer_entitlements_expires_at" ON "billing_customer_entitlements" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_customer_limits_customer_id" ON "billing_customer_limits" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_limits_key" ON "billing_customer_limits" USING btree ("limit_key");--> statement-breakpoint
CREATE INDEX "idx_customer_limits_customer_key" ON "billing_customer_limits" USING btree ("customer_id","limit_key");--> statement-breakpoint
CREATE INDEX "idx_customer_limits_reset_at" ON "billing_customer_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "idx_customers_external_id" ON "billing_customers" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_customers_email" ON "billing_customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_customers_stripe_id" ON "billing_customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_customers_mp_id" ON "billing_customers" USING btree ("mp_customer_id");--> statement-breakpoint
CREATE INDEX "idx_entitlements_key" ON "billing_entitlements" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_idempotency_key" ON "billing_idempotency_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_idempotency_expires" ON "billing_idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_lines_invoice" ON "billing_invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_payments_invoice" ON "billing_invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_payments_payment" ON "billing_invoice_payments" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_customer" ON "billing_invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_subscription" ON "billing_invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "billing_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_number" ON "billing_invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "billing_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_limits_key" ON "billing_limits" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_payment_methods_customer" ON "billing_payment_methods" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_payment_methods_provider_id" ON "billing_payment_methods" USING btree ("provider_payment_method_id");--> statement-breakpoint
CREATE INDEX "idx_payments_customer" ON "billing_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_payments_subscription" ON "billing_payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "billing_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_provider_id" ON "billing_payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "idx_payments_idempotency" ON "billing_payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_plans_active" ON "billing_plans" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_plans_livemode" ON "billing_plans" USING btree ("livemode");--> statement-breakpoint
CREATE INDEX "idx_prices_plan_id" ON "billing_prices" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_prices_active" ON "billing_prices" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_prices_stripe_price_id" ON "billing_prices" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE INDEX "idx_prices_mp_price_id" ON "billing_prices" USING btree ("mp_price_id");--> statement-breakpoint
CREATE INDEX "idx_prices_currency_interval" ON "billing_prices" USING btree ("currency","billing_interval");--> statement-breakpoint
CREATE INDEX "idx_promo_usage_code" ON "billing_promo_code_usage" USING btree ("promo_code_id");--> statement-breakpoint
CREATE INDEX "idx_promo_usage_customer" ON "billing_promo_code_usage" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_promo_codes_code" ON "billing_promo_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_promo_codes_active" ON "billing_promo_codes" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_refunds_payment" ON "billing_refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_refunds_provider_id" ON "billing_refunds" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_customer" ON "billing_subscriptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status" ON "billing_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_stripe_id" ON "billing_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_mp_id" ON "billing_subscriptions" USING btree ("mp_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_renewal" ON "billing_subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "idx_usage_records_subscription" ON "billing_usage_records" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_usage_records_metric" ON "billing_usage_records" USING btree ("metric_name");--> statement-breakpoint
CREATE INDEX "idx_usage_records_timestamp" ON "billing_usage_records" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_usage_records_idempotency" ON "billing_usage_records" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_vendor_payouts_vendor" ON "billing_vendor_payouts" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_payouts_status" ON "billing_vendor_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vendor_payouts_provider_id" ON "billing_vendor_payouts" USING btree ("provider_payout_id");--> statement-breakpoint
CREATE INDEX "idx_vendors_external_id" ON "billing_vendors" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_vendors_stripe_account" ON "billing_vendors" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE INDEX "idx_vendors_mp_merchant" ON "billing_vendors" USING btree ("mp_merchant_id");--> statement-breakpoint
CREATE INDEX "idx_dead_letter_provider_id" ON "billing_webhook_dead_letter" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "idx_dead_letter_resolved" ON "billing_webhook_dead_letter" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_provider_id" ON "billing_webhook_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_type" ON "billing_webhook_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_status" ON "billing_webhook_events" USING btree ("status");