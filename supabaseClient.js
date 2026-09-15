// Configuración e inicialización del cliente de Supabase
const SUPABASE_URL = 'https://shocrcokicbkjyoqhvil.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4XqVEqzOrlPmtH5BtyuvdA_-eaRDmOJ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);