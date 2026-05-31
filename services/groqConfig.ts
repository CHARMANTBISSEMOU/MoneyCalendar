/**
 * Configuration Groq API.
 * Les clés sont lues depuis la variable d'environnement EXPO_PUBLIC_GROQ_API_KEYS.
 * En local : définir dans .env → EXPO_PUBLIC_GROQ_API_KEYS=gsk_xxx,gsk_yyy
 * En production (EAS) : configurer via `eas env:create`
 */

const fromEnv = (process.env.EXPO_PUBLIC_GROQ_API_KEYS ?? '')
  .split(',')
  .map((k) => k.trim())
  .filter((k) => k.length > 0);

export const GROQ_API_KEYS = fromEnv;

export const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] as const;

export function assertGroqConfigured(): void {
  if (GROQ_API_KEYS.length === 0) {
    throw new Error(
      'Aucune clé Groq configurée. Ajoutez EXPO_PUBLIC_GROQ_API_KEYS dans votre fichier .env'
    );
  }
}

