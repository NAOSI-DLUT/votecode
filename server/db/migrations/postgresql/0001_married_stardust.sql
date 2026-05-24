CREATE TYPE "public"."prompt_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "generating" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "status" "prompt_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_parent_user_unique_idx" ON "prompts" USING btree (coalesce("parent", -1),"user_id");