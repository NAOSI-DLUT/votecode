CREATE TYPE "public"."prompt_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"offset" integer NOT NULL,
	"latest_prompt" integer
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" integer NOT NULL,
	"page_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"parent" integer,
	"content" text NOT NULL,
	"response" text,
	"html" text DEFAULT '' NOT NULL,
	"status" "prompt_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prompts_page_id_id_pk" PRIMARY KEY("page_id","id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text NOT NULL,
	"html_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"page_id" text NOT NULL,
	"prompt_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "votes_page_id_prompt_id_user_id_pk" PRIMARY KEY("page_id","prompt_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_id_idx" ON "prompts" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "parent_idx" ON "prompts" USING btree ("page_id","parent");--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_parent_user_unique_idx" ON "prompts" USING btree ("page_id",coalesce("parent", -1),"user_id");