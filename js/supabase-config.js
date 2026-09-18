// DCC INTERANET â€” Supabase client configuration
// Publishable/anon key only â€” protected by RLS server-side.
// Never put a service-role key in this file.
(function () {
  var SUPABASE_URL = 'https://zwqnfhctujeqwnksrgls.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_KEcPXjhGtVzhmbIvvWpMlA_0OSaPBEQ';

  window.dccSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
})();
