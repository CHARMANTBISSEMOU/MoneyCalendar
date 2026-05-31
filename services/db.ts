import * as SQLite from 'expo-sqlite';
import { log } from '@/utils/logger';

export const db = SQLite.openDatabaseSync('moneycalendar.db');

function getTableColumns(table: string): string[] {
  try {
    return db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name);
  } catch {
    return [];
  }
}

function tableExists(table: string): boolean {
  const row = db.getFirstSync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    table
  );
  return !!row;
}

function tryAddColumn(sql: string) {
  try {
    db.execSync(sql);
  } catch {
    // colonne déjà présente
  }
}

function toCategoryCode(nom: string, id: string): string {
  const code = nom
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24);
  if (code.length >= 2) return code;
  return `CAT_${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** Ancienne app mobile : categories(nom) → categories(code, name) */
function migrateLegacyCategories() {
  const cols = getTableColumns('categories');
  if (cols.length === 0) return;
  if (cols.includes('name') && cols.includes('code')) {
    tryAddColumn(`ALTER TABLE categories ADD COLUMN icone TEXT DEFAULT '📦'`);
    tryAddColumn(`ALTER TABLE categories ADD COLUMN description TEXT`);
    tryAddColumn(`ALTER TABLE categories ADD COLUMN type TEXT DEFAULT 'personnelle'`);
    return;
  }

  if (!cols.includes('nom')) return;

  log.info('DB', 'Migration catégories (ancien schéma mobile → nouveau)');

  db.execSync(`
    CREATE TABLE categories_new (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'personnelle',
      icone TEXT DEFAULT '📦'
    );
  `);

  const oldRows = db.getAllSync<{ id: string; nom: string; icone: string | null }>(
    'SELECT id, nom, icone FROM categories'
  );

  for (const row of oldRows) {
    const code = toCategoryCode(row.nom, row.id);
    db.runSync(
      `INSERT OR IGNORE INTO categories_new (code, name, description, type, icone) VALUES (?, ?, '', 'personnelle', ?)`,
      code,
      row.nom,
      row.icone ?? '📦'
    );
  }

  db.execSync('DROP TABLE categories');
  db.execSync('ALTER TABLE categories_new RENAME TO categories');
}

/** Ancienne app mobile : depenses → transactions */
function migrateLegacyDepenses() {
  if (!tableExists('depenses')) return;

  log.info('DB', 'Migration dépenses → transactions');

  const depenseCols = getTableColumns('depenses');
  const hasSyncAction = depenseCols.includes('sync_action');

  const whereDelete = hasSyncAction ? "WHERE sync_action IS NULL OR sync_action != 'delete'" : '';

  db.execSync(`
    INSERT OR IGNORE INTO transactions (id, date, categorie, beneficiaire, libelle, montant, type, planifie, tag_non_planifie, mois_budget)
    SELECT
      id,
      date_depense,
      categorie,
      '',
      COALESCE(description, 'Sans libellé'),
      montant,
      'sortie',
      1,
      0,
      substr(date_depense, 1, 7)
    FROM depenses
    ${whereDelete}
  `);

  db.execSync('DROP TABLE depenses');
}

/** Ancienne app mobile : budgets(id, mois) → budgets(mois PK) */
function migrateLegacyBudgets() {
  const cols = getTableColumns('budgets');
  if (cols.length === 0) return;
  if (cols.includes('mois') && !cols.includes('id')) return;

  if (cols.includes('id') && cols.includes('mois')) {
    log.info('DB', 'Migration table budgets');
    db.execSync(`
      CREATE TABLE budgets_new (mois TEXT PRIMARY KEY, montant REAL NOT NULL);
      INSERT OR REPLACE INTO budgets_new (mois, montant)
      SELECT mois, montant FROM budgets GROUP BY mois;
      DROP TABLE budgets;
      ALTER TABLE budgets_new RENAME TO budgets;
    `);
  }
}

function seedDefaultCategories() {
  const countResult = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (countResult && countResult.count > 0) return;

  db.execSync(`
    INSERT INTO categories (code, name, description, type, icone) VALUES
    ('SCOL', 'Scolarité', 'Frais académiques', 'personnelle', '📚'),
    ('ALIM', 'Alimentation', 'Courses, marchés', 'personnelle', '🍽️'),
    ('RESTO', 'Restaurant', 'Repas en extérieur', 'personnelle', '🍔'),
    ('VETEMENTS', 'Vêtements', 'Habits, accessoires', 'personnelle', '👕'),
    ('TRANSPORT', 'Transport', 'Taxi, bus, carburant', 'personnelle', '🚗'),
    ('CONNEXION', 'Connexion', 'Internet, mobile', 'personnelle', '📱'),
    ('SANTE', 'Santé', 'Médicaments, soins', 'personnelle', '💊'),
    ('SOINS_PERSO', 'Soins personnels', 'Coiffure, hygiène', 'personnelle', '💇'),
    ('ABONNEMENTS', 'Abonnements', 'Services numériques', 'personnelle', '📺'),
    ('MATERIEL', 'Matériel', 'Électronique, outils', 'personnelle', '💻'),
    ('CHARGES', 'Charges & Domestique', 'Eau, électricité, loyer', 'personnelle', '🏠'),
    ('BANQUE', 'Services bancaires', 'Frais bancaires', 'personnelle', '🏦'),
    ('AIDE_FIXE', 'Aide tiers - fixes', 'Personnes aidées régulièrement', 'tiers', '🤝'),
    ('AIDE_PONCT', 'Aide tiers - ponctuelle', 'Demandes imprévues', 'tiers', '🆘'),
    ('ACHAT_TIERS', 'Achats pour tiers', 'Biens pour autrui', 'tiers', '🛒'),
    ('CADEAUX', 'Cadeaux', 'Achats offerts', 'tiers', '🎁'),
    ('PRET_ACCORDE', 'Prêt accordé', 'Argent prêté', 'tiers', '💸'),
    ('DETTE_REMB', 'Dette remboursée', 'Remboursement dette', 'tiers', '✅'),
    ('REMB_RECU', 'Remboursement reçu', 'Argent récupéré', 'speciale', '💰'),
    ('CONTRIBUTION', 'Contribution reçue', 'Participation reçue', 'speciale', '🎉'),
    ('REVENU', 'Revenu', 'Salaire, gain', 'speciale', '💵'),
    ('EPARGNE', 'Épargne', 'Argent mis de côté', 'speciale', '🐷'),
    ('PROVISION', 'Provision', 'Réserve future', 'speciale', '📦'),
    ('DIVERS', 'Divers', 'Dernier recours', 'speciale', '📌');
  `);
  log.info('DB', 'Catégories par défaut insérées');
}

export const initDB = () => {
  log.info('DB', 'Initialisation SQLite…');
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'personnelle',
        icone TEXT DEFAULT '📦'
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        categorie TEXT NOT NULL,
        sous_categorie TEXT,
        beneficiaire TEXT,
        libelle TEXT NOT NULL,
        montant REAL NOT NULL,
        type TEXT NOT NULL,
        planifie INTEGER NOT NULL DEFAULT 1,
        tag_non_planifie INTEGER NOT NULL DEFAULT 0,
        creance_id TEXT,
        mois_budget TEXT NOT NULL,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS budgets (
        mois TEXT PRIMARY KEY,
        montant REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS creances (
        id TEXT PRIMARY KEY,
        debiteur TEXT NOT NULL,
        montant_initial REAL NOT NULL,
        montant_restant REAL NOT NULL,
        date_creation TEXT NOT NULL,
        date_rappel TEXT,
        statut TEXT NOT NULL,
        motif TEXT
      );

      CREATE TABLE IF NOT EXISTS depenses_planifiees (
        id TEXT PRIMARY KEY,
        libelle TEXT NOT NULL,
        montant REAL NOT NULL,
        categorie TEXT NOT NULL,
        date_prevue TEXT NOT NULL,
        rappel_actif INTEGER NOT NULL DEFAULT 1,
        rappel_envoye INTEGER NOT NULL DEFAULT 0,
        statut TEXT NOT NULL DEFAULT 'en_attente',
        note TEXT
      );
    `);

    migrateLegacyCategories();
    migrateLegacyBudgets();
    migrateLegacyDepenses();

    tryAddColumn(`ALTER TABLE categories ADD COLUMN icone TEXT DEFAULT '📦'`);
    tryAddColumn(`ALTER TABLE categories ADD COLUMN description TEXT`);
    tryAddColumn(`ALTER TABLE categories ADD COLUMN type TEXT DEFAULT 'personnelle'`);

    seedDefaultCategories();

    const countResult = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
    log.info('DB', 'Base prête', { categoriesCount: countResult?.count ?? 0 });
  } catch (error) {
    log.error('DB', 'Échec initialisation', error);
    throw error;
  }
};
