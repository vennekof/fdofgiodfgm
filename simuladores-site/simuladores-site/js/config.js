/**
 * Config pública del sitio.
 * Claves Supabase: solo publishable/anon (nunca service_role).
 */
window.SITE_CONFIG = {
  siteName: "LOS SIMULADORES",
  badgeText: "Serie argentina · HD",
  heroTitle: "Los Simuladores",
  heroSubtitle: "Las 2 temporadas completas en buena calidad",
  heroBg: "fondo-simuladores.jpg",
  tabTitle: "Los Simuladores | Capítulos HD",
  ogDescription: "Las 2 temporadas completas en buena calidad. Historias imposibles, soluciones perfectas.",
  donateUrl: "https://ceneka.net/Vennek",
  donateText: "Proyecto fan sin fines de lucro. Si te gusta el sitio, cualquier apoyo suma.",
  seasons: {
    1: { color: "#3eb34f" },
    2: { color: "#2a7a94" }
  },
  contacts: {
    discord: "https://discord.com/users/553318881490370571",
    kick: "https://kick.com/vennek",
    email: "vennekof@gmail.com"
  },
  adminSessionMinutes: 60,
  storageKey: "simuladores_v5",
  /** Google Analytics */
  gaId: "G-XZYN0NB2DM",
  /** Supabase */
  supabaseUrl: "https://wxmnioanxrpgzzvkbpaa.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bW5pb2FueHJwZ3p6dmticGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MDkxNjQsImV4cCI6MjEwNjA4NTE2NH0.IdVSzD55prA23Fz99VSJ9Sl6S_pMGppZtzViHSPgke8",
  /** Solo este email puede escribir (debe coincidir con Auth) */
  adminEmail: "vennekof@gmail.com"
};
