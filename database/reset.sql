-- VEYRA — Database Reset Script
-- Drops all tables, re-runs schema.sql and seed.sql

USE `veyra_db`;
SOURCE schema.sql;
SOURCE seed.sql;
