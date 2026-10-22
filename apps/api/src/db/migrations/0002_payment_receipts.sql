ALTER TABLE "payments" ADD COLUMN "receipt_key" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_mime" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_bytes" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_receipt_mime_check" CHECK ("payments"."receipt_mime" IS NULL OR "payments"."receipt_mime" IN ('image/jpeg','image/png','image/webp'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_receipt_bytes_check" CHECK ("payments"."receipt_bytes" IS NULL OR "payments"."receipt_bytes" BETWEEN 1 AND 5242880);