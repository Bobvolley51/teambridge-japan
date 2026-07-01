// lib/usePlayerProfiles.js — shared hook for consistent player display across all dashboards

import { useState, useEffect } from 'react';
import { supabase } from './supabase';

/**
 * Returns a map of user_id → profile with full Latin name, jersey number, position.
 * Automatically loaded once; lightweight cache via module-level variable.
 */
export function usePlayerProfiles() {
  const [profiles, setProfiles] = useState({});
  useEffect(() => {
    supabase.from('profiles')
      .select('id, first_name, last_name, display_name, jersey_number, position')
      .eq('role', 'Player')
      .then(({ data }) => {
        const map = {};
        for (const p of (data ?? [])) map[p.id] = p;
        setProfiles(map);
      });
  }, []);
  return profiles;
}

/**
 * Returns "#jersey DisplayName" — the official display for any dashboard.
 * display_name is the normalized name of record; falls back to first/last or fallbackName.
 */
export function playerLabel(profile, fallbackName) {
  if (!profile) return fallbackName ?? '—';
  const name = profile.display_name
    || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    || fallbackName;
  return profile.jersey_number != null ? `#${profile.jersey_number} ${name}` : name;
}

/**
 * Sort comparator: by jersey number (nulls last), then alphabetically by display_name.
 */
export function compareByJersey(a, b) {
  const ja = a?.jersey_number ?? 9999;
  const jb = b?.jersey_number ?? 9999;
  if (ja !== jb) return ja - jb;
  const na = a?.display_name || [a?.first_name, a?.last_name].filter(Boolean).join(' ');
  const nb = b?.display_name || [b?.first_name, b?.last_name].filter(Boolean).join(' ');
  return na.localeCompare(nb);
}
