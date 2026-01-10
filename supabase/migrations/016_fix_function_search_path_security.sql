-- Migration: Fix function search_path security vulnerability
-- Issue: Functions without explicit search_path are vulnerable to search path injection
-- Fix: Set search_path = '' and use fully qualified object names
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================
-- Recreate functions with secure search_path
-- ============================================

-- 1. update_updated_at_column - trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 2. update_bookmark_search_vector - trigger function for full-text search
CREATE OR REPLACE FUNCTION public.update_bookmark_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector =
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.blurb, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 3. handle_new_user - SECURITY DEFINER function (highest priority fix)
-- This function runs with owner privileges, so search_path security is critical
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';
