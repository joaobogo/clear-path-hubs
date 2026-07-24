
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_display_name text,
  ADD COLUMN IF NOT EXISTS brand_primary_color text,
  ADD COLUMN IF NOT EXISTS brand_accent_color text;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_brand_primary_color_check,
  DROP CONSTRAINT IF EXISTS organizations_brand_accent_color_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_brand_primary_color_check
    CHECK (brand_primary_color IS NULL OR brand_primary_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD CONSTRAINT organizations_brand_accent_color_check
    CHECK (brand_accent_color IS NULL OR brand_accent_color ~ '^#[0-9a-fA-F]{6}$');
