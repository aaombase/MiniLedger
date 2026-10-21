CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"friend_name" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"due_date" date NOT NULL,
	"note" text,
	"repaid_at" timestamp with time zone,
	"receipt_key" text,
	"receipt_mime" text,
	"receipt_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loans_friend_name_check" CHECK (char_length("loans"."friend_name") BETWEEN 1 AND 60),
	CONSTRAINT "loans_amount_minor_check" CHECK ("loans"."amount_minor" BETWEEN 100 AND 100000000),
	CONSTRAINT "loans_currency_check" CHECK ("loans"."currency" = 'INR'),
	CONSTRAINT "loans_note_check" CHECK ("loans"."note" IS NULL OR char_length("loans"."note") <= 200),
	CONSTRAINT "loans_receipt_mime_check" CHECK ("loans"."receipt_mime" IS NULL OR "loans"."receipt_mime" IN ('image/jpeg','image/png','image/webp')),
	CONSTRAINT "loans_receipt_bytes_check" CHECK ("loans"."receipt_bytes" IS NULL OR "loans"."receipt_bytes" BETWEEN 1 AND 5242880)
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_challenges_attempts_check" CHECK ("otp_challenges"."attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_e164_unique" UNIQUE("phone_e164"),
	CONSTRAINT "users_phone_e164_check" CHECK ("users"."phone_e164" ~ '^\+[1-9][0-9]{6,14}$')
);
--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loans_user_due_idx" ON "loans" USING btree ("user_id","due_date") WHERE "loans"."repaid_at" IS NULL;--> statement-breakpoint
CREATE INDEX "loans_user_created_idx" ON "loans" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "otp_challenges_phone_created_idx" ON "otp_challenges" USING btree ("phone_e164","created_at" DESC NULLS LAST);