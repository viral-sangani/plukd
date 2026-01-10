-- Migration: Enable pgvector extension
-- This must run before 013_add_semantic_search.sql
-- The extension is required for the vector data type

CREATE EXTENSION IF NOT EXISTS vector;
