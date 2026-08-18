// Uses only your public anon key. Never put a service-role key in this project.
const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
