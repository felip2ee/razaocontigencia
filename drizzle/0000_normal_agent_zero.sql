CREATE TYPE "public"."account_slot" AS ENUM('wa1', 'wa2', 'business');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('ativa', 'aposentada');--> statement-breakpoint
CREATE TYPE "public"."chip_local" AS ENUM('pasta', 'gaveta', 'bandeja');--> statement-breakpoint
CREATE TYPE "public"."chip_status" AS ENUM('novo', 'em_uso', 'aposentado');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('ativo', 'quarentena', 'aposentado');--> statement-breakpoint
CREATE TYPE "public"."incident_resultado" AS ENUM('pendente', 'recuperada', 'perdida');--> statement-breakpoint
CREATE TYPE "public"."incident_tipo" AS ENUM('restricao', 'ban');--> statement-breakpoint
CREATE TYPE "public"."warmup_categoria" AS ENUM('conversa', 'perfil', 'grupo', 'midia');--> statement-breakpoint
CREATE TYPE "public"."warmup_task_status" AS ENUM('pendente', 'feito', 'pulado');--> statement-breakpoint
CREATE TABLE "account" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"slot" "account_slot" NOT NULL,
	"chip_id" text NOT NULL,
	"ativada_em" date NOT NULL,
	"status" "account_status" DEFAULT 'ativa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chip" (
	"id" text PRIMARY KEY NOT NULL,
	"operadora" text NOT NULL,
	"numero" text NOT NULL,
	"status" "chip_status" DEFAULT 'novo' NOT NULL,
	"local" "chip_local" DEFAULT 'pasta' NOT NULL,
	"posicao" text,
	"bandeja_device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device" (
	"id" text PRIMARY KEY NOT NULL,
	"apelido" text,
	"status" "device_status" DEFAULT 'ativo' NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"tipo" "incident_tipo" NOT NULL,
	"inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"fim" timestamp with time zone,
	"resultado" "incident_resultado",
	"notas" text
);
--> statement-breakpoint
CREATE TABLE "warmup_action" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"categoria" "warmup_categoria" NOT NULL,
	"idade_min_dias" integer DEFAULT 0 NOT NULL,
	"idade_max_dias" integer,
	"peso" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "warmup_action_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "warmup_task" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"action_id" integer NOT NULL,
	"data" date NOT NULL,
	"par_account_id" integer,
	"status" "warmup_task_status" DEFAULT 'pendente' NOT NULL,
	"feito_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_chip_id_chip_id_fk" FOREIGN KEY ("chip_id") REFERENCES "public"."chip"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip" ADD CONSTRAINT "chip_bandeja_device_id_device_id_fk" FOREIGN KEY ("bandeja_device_id") REFERENCES "public"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warmup_task" ADD CONSTRAINT "warmup_task_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warmup_task" ADD CONSTRAINT "warmup_task_action_id_warmup_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."warmup_action"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warmup_task" ADD CONSTRAINT "warmup_task_par_account_id_account_id_fk" FOREIGN KEY ("par_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_slot_ativo" ON "account" USING btree ("device_id","slot") WHERE "account"."status" = 'ativa';--> statement-breakpoint
CREATE UNIQUE INDEX "account_chip_ativo" ON "account" USING btree ("chip_id") WHERE "account"."status" = 'ativa';--> statement-breakpoint
CREATE UNIQUE INDEX "incident_aberto_unico" ON "incident" USING btree ("account_id") WHERE "incident"."fim" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "warmup_task_unica" ON "warmup_task" USING btree ("account_id","action_id","data");