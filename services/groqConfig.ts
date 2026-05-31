/**
 * Clés Groq via variable d'environnement (jamais en dur dans le dépôt).
 * Créez un fichier `.env` à la racine :
 * EXPO_PUBLIC_GROQ_API_KEYS=gsk_votre_cle,gsk_autre_cle
 */
const raw = process.env.EXPO_PUBLIC_GROQ_API_KEYS ?? '';

export const GROQ_API_KEYS = raw
  .split(',')
  .map((k) => k.trim())
  .filter((k) => k.length > 0);

export const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] as const;

export function assertGroqConfigured(): void {
  if (GROQ_API_KEYS.length === 0) {
    throw new Error(
      'Clé Groq manquante. Ajoutez EXPO_PUBLIC_GROQ_API_KEYS dans un fichier .env (voir .env.example).'
    );
  }
}
