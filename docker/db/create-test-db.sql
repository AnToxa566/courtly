-- Runs once, on an empty data volume. The e2e tests use this database so they
-- can truncate tables without touching development data.
CREATE DATABASE courtly_test OWNER courtly;
