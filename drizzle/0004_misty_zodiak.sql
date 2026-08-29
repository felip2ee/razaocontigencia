CREATE TABLE "evolution_server" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"url" text NOT NULL,
	"api_key" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "evolution_server_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "evolution_server_url" ON "evolution_server" USING btree ("url");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_evolution_server_id_evolution_server_id_fk" FOREIGN KEY ("evolution_server_id") REFERENCES "public"."evolution_server"("id") ON DELETE no action ON UPDATE no action;