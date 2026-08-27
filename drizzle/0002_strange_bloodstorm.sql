CREATE TYPE "public"."chip_origem" AS ENUM('propria', 'externa');--> statement-breakpoint
CREATE TYPE "public"."device_origem" AS ENUM('propria', 'externa');--> statement-breakpoint
ALTER TABLE "chip" ADD COLUMN "origem" "chip_origem" DEFAULT 'propria' NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "origem" "device_origem" DEFAULT 'propria' NOT NULL;