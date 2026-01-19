CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS rte;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  amo_lead_id INTEGER UNIQUE NOT NULL,
  hash_slug TEXT UNIQUE NOT NULL,
  status_step INTEGER CHECK (status_step >= 1 AND status_step <= 4),
  status_label TEXT,
  car_info JSONB DEFAULT '{}'::jsonb,
  permit_info JSONB DEFAULT '{}'::jsonb,
  manager_contact JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_orders_hash_slug ON public.orders(hash_slug);
CREATE INDEX IF NOT EXISTS idx_orders_amo_lead_id ON public.orders(amo_lead_id);

CREATE TABLE IF NOT EXISTS rte.amocrm_tokens (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_in INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION rte.set_amocrm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_amocrm_tokens_updated_at ON rte.amocrm_tokens;

CREATE TRIGGER trg_amocrm_tokens_updated_at
BEFORE UPDATE ON rte.amocrm_tokens
FOR EACH ROW
EXECUTE FUNCTION rte.set_amocrm_tokens_updated_at();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
