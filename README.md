# MoneyCalendar

Application mobile de gestion de budget personnel, développée avec **Expo SDK 55** et **React Native**. Les données sont stockées **localement** sur l’appareil (SQLite) : pas de compte cloud obligatoire.

**MoneyCalendar** aide à suivre dépenses, revenus, prêts, dépenses planifiées et à produire des rapports PDF avec analyse critique assistée par IA.

## 📲 Télécharger l'application

> **[⬇️ Télécharger MoneyCalendar APK (Android)](https://expo.dev/accounts/charmantbissemou/projects/temp_app/builds)**
>
> Rendez-vous sur la page des builds Expo, sélectionnez le dernier build **preview** ou **production**, puis téléchargez le fichier `.apk` et installez-le sur votre téléphone Android.

---

## Fonctionnalités principales

| Module | Description |
|--------|-------------|
| **Accueil** | Budget mensuel, entrées d’argent du mois, barre de progression, analyse intelligente (rythme de dépenses, prêts en cours, comportement). |
| **Dépenses** | Liste des transactions du mois, filtrage par période. |
| **Money AI** | Saisie en langage naturel : l’IA propose catégorie, montant, type (sortie/entrée), prêt ou planification. |
| **Rapports** | Export PDF (dépenses seules, analyse seule, ou complet) sur un mois ou une plage de dates. |
| **Catégories** | Gestion des catégories (personnelles, tiers, spéciales). |
| **Paramètres** | Informations application. |

### Gestion financière avancée

- **Budget mensuel** en FCFA, avec reste à dépenser et pourcentage utilisé.
- **Entrées d’argent** (salaire, revenus, remboursements reçus) affichées à côté du budget.
- **Prêts & remboursements** : suivi par personne (montant initial, reste dû, statut soldé / en cours).
- **Dépenses planifiées** avec date : rappels in-app à l’échéance.
- **Comportement** : repérage des dépenses marquées « non planifiées ».
- **Rapports IA** en 5 étapes (catégories, tiers, prêts, libellés, synthèse) avec réduction des répétitions entre sections.

---

## Captures d’écran & navigation

L’application utilise une barre d’onglets :

```
Accueil → Dépenses → Money AI → Rapports → Paramètres
```

Depuis l’accueil : bouton **+** pour ajouter une dépense manuellement, lien vers les **catégories**.

---

## Money AI — exemples de phrases

Décrivez une opération en français ; l’IA renvoie une proposition structurée à confirmer.

| Intention | Exemple |
|-----------|---------|
| Dépense | `Restaurant Kazoo 15000` |
| Prêt | `Prêt à Paul 50000` |
| Remboursement reçu | `Paul me rembourse 20000` |
| Revenu | `Salaire reçu 250000` |
| Planifier | `Prévoir loyer 80000 le 2026-06-05` |

Après analyse :

1. Créez la **nouvelle catégorie** si l’IA la propose.
2. Appuyez sur **Confirmer & Enregistrer**.

Les prêts mettent à jour la table des **créances** ; les remboursements indiquent si la dette est **soldée**.

---

## Rapports PDF

1. Onglet **Rapports**.
2. Choisissez **un mois** ou une **plage de dates**.
3. Mode d’export :
   - **Dépenses seules** — liste + tableau budget / entrées / dépenses.
   - **Analyses seules** — texte critique IA.
   - **Complet** — les deux.
4. Le PDF est généré puis partagé via le menu système (WhatsApp, Drive, etc.).

Le rapport inclut notamment :

- Totaux sorties et entrées.
- Tableau des **prêts** (initial, reste dû, statut).
- Analyse par catégorie, tiers, créances et synthèse.

> L’analyse IA nécessite une connexion Internet et des clés API Groq valides (voir configuration).

---

## Architecture technique

```
app/                    # Écrans Expo Router (tabs + modales)
  (tabs)/index.tsx      # Tableau de bord
  (tabs)/chat.tsx       # Money AI
  (tabs)/reports.tsx    # Export PDF
  add-expense.tsx       # Saisie manuelle
services/
  db.ts                 # SQLite + migrations
  data.ts               # Repositories (transactions, budgets, créances…)
  aiService.ts          # IA chat (Groq)
  reportData.ts         # Agrégation pour rapports
  reportAnalysis.ts     # Analyse rapport (Groq)
  reportPdf.ts          # HTML → PDF
types/models.ts         # Types TypeScript
utils/                  # Format, analyse locale, rappels
```

### Base de données locale (SQLite)

| Table | Rôle |
|-------|------|
| `transactions` | Dépenses et entrées (catégorie, bénéficiaire, planifié, créance liée…). |
| `budgets` | Budget par mois (`YYYY-MM`). |
| `categories` | Codes catégories (SCOL, ALIM, PRET_ACCORDE, REVENU…). |
| `creances` | Prêts accordés et suivi des remboursements. |
| `depenses_planifiees` | Dépenses futures avec date de rappel. |

Les données restent sur l’appareil dans `moneycalendar.db`.

---

## Prérequis

- [Node.js](https://nodejs.org/) 20 LTS (recommandé)
- [npm](https://www.npmjs.com/)
- [Expo Go](https://expo.dev/go) sur téléphone **ou** émulateur Android / iOS
- Compte [Groq](https://console.groq.com/) pour les clés API (IA chat + rapports)

---

## Installation

```bash
git clone https://github.com/CHARMANTBISSEMOU/MoneyCalendar.git
cd MoneyCalendar
npm install
```

### Configuration IA (obligatoire pour Money AI et rapports)

1. Créez un compte sur [console.groq.com](https://console.groq.com/).
2. Copiez le modèle d’environnement :

```bash
cp .env.example .env
```

3. Éditez `.env` et ajoutez vos clés (séparées par des virgules si vous en avez plusieurs) :

```env
EXPO_PUBLIC_GROQ_API_KEYS=gsk_votre_cle_ici
```

4. Redémarrez Expo (`npm start`).

> **Sécurité :** le fichier `.env` n’est jamais envoyé sur GitHub. Ne commitez pas de clés API.

---

## Lancer l’application

```bash
# Démarrage avec tunnel (pratique avec Expo Go)
npm start

# Réseau local (même Wi‑Fi)
npm run start:lan

# Cache Metro vidé
npm run start:fresh

# Émulateur
npm run android
npm run ios
```

Scannez le QR code avec **Expo Go** (Android / iOS).

Documentation Expo : [docs.expo.dev — SDK 55](https://docs.expo.dev/versions/v55.0.0/)

---

## Scripts npm

| Commande | Action |
|----------|--------|
| `npm start` | `expo start` (tunnel + port 8081) |
| `npm run build:apk` | Build APK preview via EAS |
| `npm run build:apk:prod` | Build APK production via EAS |
| `npm run update` | Envoyer une mise à jour OTA (preview) |
| `npm run update:prod` | Envoyer une mise à jour OTA (production) |
| `npm run android` | Ouvre sur Android |
| `npm run ios` | Ouvre sur iOS |

---

## 🔄 Mises à jour à distance (OTA)

L'application intègre **Expo EAS Update** : les corrections JavaScript sont envoyées à distance sans re-builder l'APK.

### Comment ça marche

1. L'application vérifie automatiquement au démarrage s'il y a une mise à jour disponible.
2. Si oui, elle la télécharge et propose de redémarrer.
3. Les utilisateurs reçoivent la correction **sans rien faire**.

### Envoyer une mise à jour

```bash
# Mise à jour pour les builds preview
npm run update "description de la correction"

# Mise à jour pour les builds production
npm run update:prod "description de la correction"
```

> **Note** : les mises à jour OTA ne fonctionnent que pour le code JavaScript et les assets. Les changements de code natif (nouvelles dépendances, icônes, permissions) nécessitent un nouveau build APK.

---

## Catégories par défaut

L’app initialise des catégories courantes : scolarité, alimentation, transport, santé, prêt accordé, remboursement reçu, revenu, épargne, etc. Vous pouvez en ajouter via **Catégories** ou via une suggestion de l’IA.

---

## Installer l’APK (application autonome, pas Expo Go)

> **Expo Go** sert au développement (scanner un QR code).  
> L’**APK** est l’application installable **MoneyCalendar** sur Android, sans Expo Go.

### Vos références Expo (déjà dans le projet)

| Élément | Valeur |
|---------|--------|
| Compte Expo | `charmantbissemou` |
| Projet EAS | `@charmantbissemou/temp_app` |
| Project ID | `44b322a4-d69a-47b9-9a91-09e047a710b8` |
| Package Android | `com.charmantbissemou.moneycalendar` |
| Profil APK | `preview` dans `eas.json` (`buildType: apk`) |

### Générer l’APK (une fois, sur votre PC)

1. Connecté à Expo (`npx eas-cli whoami` doit afficher votre compte).
2. **Première fois** : créer le certificat Android (répondre **Oui** quand EAS propose de générer un keystore) :

```bash
npm run build:apk
```

3. Attendre la fin du build sur [expo.dev](https://expo.dev) → projet **temp_app** → Builds.
4. Télécharger le fichier **.apk** et l’installer sur le téléphone (autoriser les sources inconnues si besoin).

### IA dans l’APK

Les clés Groq ne sont pas dans le dépôt Git. Avant le build, configurez-les sur EAS :

```bash
npx eas-cli env:create --name EXPO_PUBLIC_GROQ_API_KEYS --value "gsk_cle1,gsk_cle2" --environment preview --visibility secret
```

Puis relancez `npm run build:apk`.

---

## Rappels

À l’ouverture de l’**accueil**, l’app peut afficher :

- Dépenses planifiées arrivées à échéance ;
- Prêts dont la date de rappel est dépassée.

Les notifications push système ne sont pas encore intégrées (rappels in-app uniquement).

---

## Stack

- Expo 55 · React Native 0.83 · React 19
- expo-router · expo-sqlite · expo-print · expo-sharing
- TypeScript
- Groq API (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`)

---

## Auteur

**Charleston store** — MoneyCalendar

---

## Licence

Projet privé — usage personnel. Contactez le dépôt pour toute réutilisation ou contribution.
