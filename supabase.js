// Supabase client setup (client-side)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://xxmgdwemkffobwepvioo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4bWdkd2Vta2Zmb2J3ZXB2aW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTUzNTgsImV4cCI6MjA4ODkzMTM1OH0.SgwwIF0R2fWlVHAk7Q2YT5P26cBAUmDbW861knD233U";
const STORAGE_BUCKET = "boredlabs-assets";

const isSupabaseConfigured = ![SUPABASE_URL, SUPABASE_ANON_KEY].some(
  (value) => !value || value === "REPLACE_ME"
);

const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export { supabase, isSupabaseConfigured, STORAGE_BUCKET };
