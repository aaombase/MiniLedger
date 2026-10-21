CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"paid_on" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_minor_check" CHECK ("payments"."amount_minor" BETWEEN 1 AND 100000000),
	CONSTRAINT "payments_note_check" CHECK ("payments"."note" IS NULL OR char_length("payments"."note") <= 200)
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_loan_created_idx" ON "payments" USING btree ("loan_id","created_at" DESC NULLS LAST);--> statement-breakpoint
-- Loans repaid before payments existed get one payment for the full amount, dated in the owner's timezone.
INSERT INTO "payments" ("loan_id", "amount_minor", "paid_on", "created_at")
SELECT l."id", l."amount_minor", (l."repaid_at" AT TIME ZONE u."timezone")::date, l."repaid_at"
FROM "loans" l JOIN "users" u ON u."id" = l."user_id"
WHERE l."repaid_at" IS NOT NULL;
