import { createClient } from '@supabase/supabase-js';

// Use fallback placeholders so the module never throws at build time.
// In production/preview Vercel builds the real NEXT_PUBLIC_ values are
// inlined by the compiler and the placeholders are never used.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL    ?? 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
);