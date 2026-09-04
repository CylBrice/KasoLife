'use strict';
// Client Supabase uniquement pour le Storage (fichiers médias)
// Les opérations DB passent par supabase.js (pg direct)
const { createClient } = require('@supabase/supabase-js');

const storageClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

module.exports = storageClient;
