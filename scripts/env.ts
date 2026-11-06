// Imported first by every script so .env.local is loaded before lib/openai reads it.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: scripts run in no-key mode.
}
