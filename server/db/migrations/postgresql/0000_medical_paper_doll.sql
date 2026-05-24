CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"offset" integer NOT NULL,
	"latest_prompt" integer
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"parent" integer,
	"content" text NOT NULL,
	"response" text,
	"html" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"prompt_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "votes_prompt_id_user_id_pk" PRIMARY KEY("prompt_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_parent_prompts_id_fk" FOREIGN KEY ("parent") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_id_idx" ON "prompts" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "parent_idx" ON "prompts" USING btree ("parent");