-- V6: Convert disruptions.kind from custom enum to varchar for standard JPA compatibility
ALTER TABLE disruptions ALTER COLUMN kind TYPE varchar(50) USING kind::varchar;
