import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wumhrvpycrjzhfhlepxi.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_cNZ6VtyqPYsfzNZsZ3aX0w_e3oQ_IgG';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
