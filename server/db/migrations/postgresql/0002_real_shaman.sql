DROP INDEX "prompts_parent_user_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_parent_user_unique_idx" ON "prompts" USING btree ("page_id",coalesce("parent", -1),"user_id");