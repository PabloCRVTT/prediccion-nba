// ============================================================
// CONFIGURACIÓN — Predicción NBA
// Usa el mismo proyecto Supabase que la polla (tablas nba_* aparte)
// ============================================================

const SUPABASE_URL = "https://efaavgdibrlhnmjdbapw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYWF2Z2RpYnJsaG5tamRiYXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MjQyMzQsImV4cCI6MjA5NjIwMDIzNH0.yds1ft6dkiTAxtn7xu185sxp2tOyYZkkqHa6jhv2kKI";

// ----- Configuración del partido -----
// ✏️ EDITA con los equipos reales del partido de mañana
const NBA_GAME = {
  id: "2026-06-06",                 // identificador único del partido
  fecha: "Sábado 6 de junio, 2026",
  hora: "21:00",
  // ESPN usa fecha YYYYMMDD para buscar resultados automáticos
  espnDate: "20260606",
  local:     { nombre: "New York Knicks",   abbr: "NYK", emoji: "🗽", color: "#006bb6" },
  visitante: { nombre: "San Antonio Spurs", abbr: "SAS", emoji: "⭐", color: "#000000" },
  // Cierre de predicciones (antes del salto inicial)
  cierre: "2026-06-06T21:00:00",
};

// Emails con permisos de admin (configuran partido y cargan resultados)
const NBA_CONFIG = {
  admins: ["pablocrovetto87@gmail.com"],
};

// ----- Sistema de puntuación -----
const NBA_PUNTOS = {
  // Predicción INICIAL de quién gana (se bloquea al elegir)
  ganador: 30,
  // Por cada equipo en cada cuarto: cercanía al marcador real
  // puntos = max(0, cercaniaMax - |prediccion - real|)
  cercaniaMax: 5,        // acierto exacto de un equipo en un cuarto = 5 pts
  // Bonus si el marcador FINAL exacto (ambos equipos)
  finalExacto: 25,
  // Bonus si acierta quién gana según el marcador final
  ganadorFinal: 10,
};
