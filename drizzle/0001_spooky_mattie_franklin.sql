CREATE TYPE "public"."evolution_status" AS ENUM('desconhecido', 'aberta', 'conectando', 'fechada');--> statement-breakpoint
CREATE TYPE "public"."proxy_status" AS ENUM('sem_conexao', 'ativa', 'inativa');--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "evolution_status" "evolution_status" DEFAULT 'desconhecido' NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "proxy_status" "proxy_status" DEFAULT 'sem_conexao' NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "status_verificado_em" timestamp with time zone;