-- V4: Add deleted flag to disruptions table for soft-delete support
ALTER TABLE disruptions ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
