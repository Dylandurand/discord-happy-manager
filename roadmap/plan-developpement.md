# Plan de Développement — Bot Happy Manager

## Vue d'ensemble

**Objectif** : Développer un bot Discord motivationnel en TypeScript, déployable localement via ligne de commande, avec scheduler automatique et intégration API de citations.

**Stack technique** :
- TypeScript + Node.js
- discord.js (v14)
- SQLite (better-sqlite3)
- node-cron (scheduler)
- API de citations (Quotable API ou ZenQuotes)

**Méthodologie Git** :
- Branche principale : `main`
- Branches feature : `feature/*`
- Branches setup : `setup/*`
- Branches release : `release/*`

---

## Standards de Qualité & Bonnes Pratiques

**Tout le code TypeScript doit respecter les standards définis dans** `/resources/skills/typescript-best-practices.md` :

✅ **Documentation JSDoc complète** sur tous les exports publics (@param, @returns, @throws, @example)
✅ **Type system strict** : `strict: true`, pas de `any`, discriminated unions
✅ **Error handling** : Custom error classes, gestion async/await propre
✅ **Security** : Validation inputs (Zod), sanitization, protection secrets
✅ **Performance** : Caching, async patterns optimisés, DB queries efficaces
✅ **Testing** : Unit tests + integration tests (coverage > 80%)

**Note** : Le dossier `/resources` est exclu de git et sert uniquement de référence pour l'IA.

---

## Phase 1 : Setup & Infrastructure de Base

### Branche : `setup/project-init`

**Objectif** : Initialiser le projet TypeScript avec structure modulaire et outils de développement.

#### Commits :

**Commit 1.1** : `chore: Initialize TypeScript project with dependencies`
- `package.json` : discord.js, typescript, @types/node, ts-node, nodemon
- `tsconfig.json` : configuration stricte (strict mode, esModuleInterop)
- `.env.example` : template variables environnement
- `.gitignore` : node_modules, .env, dist/, *.db

**Commit 1.2** : `chore: Setup project structure and scripts`
```
/src
  /bot
  /commands
  /scheduler
  /content
  /db
  /config
  /listeners
  /utils
/data
/roadmap
```
- Scripts npm : `dev`, `build`, `start`, `lint`
- ESLint + Prettier configuration

**Commit 1.3** : `feat: Add environment configuration loader`
- `/src/config/env.ts` : validation variables (DISCORD_TOKEN, SQLITE_PATH, etc.)
- `/src/config/constants.ts` : constantes globales (timezones, defaults)

**Critères de validation** :
- ✅ `npm run dev` démarre sans erreur
- ✅ TypeScript compile sans warning
- ✅ Variables d'environnement validées au démarrage

---

## Phase 2 : Base de Données & Repositories

### Branche : `feature/database`

**Objectif** : Schéma SQLite + repositories pour config guilds, messages envoyés, cooldowns.

#### Commits :

**Commit 2.1** : `feat(db): Setup SQLite connection and migrations`
- `/src/db/db.ts` : connexion better-sqlite3, singleton
- `/src/db/migrations.ts` : création tables (guild_config, sent_messages, cooldowns)
- Schéma conforme spec (voir section 6.2 du spec.md)

**Commit 2.2** : `feat(db): Implement GuildConfig repository`
- `/src/db/guildConfigRepo.ts` :
  - `getGuildConfig(guildId: string)`
  - `upsertGuildConfig(config: GuildConfig)`
  - `getAllActiveGuilds()`
- Types TypeScript : `GuildConfig` interface

**Commit 2.3** : `feat(db): Implement SentMessages repository`
- `/src/db/sentRepo.ts` :
  - `recordSent(item: SentMessage)`
  - `wasSentRecently(guildId: string, contentId: string, days: number)`
  - `getRecentMessages(guildId: string, limit: number)`

**Commit 2.4** : `feat(db): Implement Cooldown repository`
- `/src/db/cooldownRepo.ts` :
  - `getCooldown(key: string): Date | null`
  - `setCooldown(key: string, until: Date)`
  - `isOnCooldown(key: string): boolean`

**Critères de validation** :
- ✅ Tables créées automatiquement au premier lancement
- ✅ Tests unitaires sur chaque repo (insert/select/update)
- ✅ Index SQL correctement appliqués

---

## Phase 3 : Bot Discord — Baseline & Commands Core

### Branche : `feature/bot-core`

**Objectif** : Client Discord opérationnel + commandes `/happy now` et `/happy settings`.

#### Commits :

**Commit 3.1** : `feat(bot): Initialize Discord client with intents`
- `/src/bot/client.ts` : client Discord.js avec intents (Guilds, GuildMessages)
- Event handler `ready` : log "Bot connecté"
- `/src/index.ts` : point d'entrée principal

**Commit 3.2** : `feat(bot): Setup slash commands registration`
- `/src/bot/registerCommands.ts` : registration automatique des slash commands
- Types : `SlashCommand` interface avec `data` (SlashCommandBuilder) et `execute`

**Commit 3.3** : `feat(commands): Implement /happy now command`
- `/src/commands/happyNow.ts` :
  - Paramètre optionnel : `category` (motivation|wellbeing|focus|team|fun)
  - Cooldown global : 60s (via cooldownRepo)
  - Appel au content provider (placeholder pour l'instant)
  - Envoi message dans canal configuré

**Commit 3.4** : `feat(commands): Implement /happy settings command`
- `/src/commands/happySettings.ts` :
  - Admin/Mod only (permissions check)
  - Affiche config actuelle (embed Discord)
  - Boutons interactifs (ou modal) pour modifier :
    - Canal cible
    - Fréquence (2 ou 3/jour)
    - Jours actifs
    - Heures (format HH:MM)
  - Sauvegarde via `guildConfigRepo.upsertGuildConfig()`

**Commit 3.5** : `feat(bot): Add interaction handlers and error handling`
- `/src/bot/client.ts` : event `interactionCreate`
- Router vers commandes appropriées
- Error handling global + logs

**Critères de validation** :
- ✅ Bot se connecte au serveur Discord
- ✅ `/happy now` envoie un message (même si contenu temporaire)
- ✅ `/happy settings` accessible uniquement aux admins
- ✅ Cooldown de 60s respecté sur `/happy now`

---

## Phase 4 : Système de Contenu & Providers

### Branche : `feature/content-system`

**Objectif** : Local pack JSON + API provider + filtres + formatage + anti-répétition.

#### Commits :

**Commit 4.1** : `feat(content): Define ContentItem types and Provider interface`
- `/src/content/types.ts` :
  - Interface `ContentItem`
  - Interface `ContentProvider`
  - Type `Category`

**Commit 4.2** : `feat(content): Create local pack JSON with 200+ messages`
- `/data/happy-pack.json` : 200-300 messages répartis par catégorie
  - motivation : 60 messages
  - wellbeing : 60 messages
  - focus : 40 messages
  - team : 40 messages
  - fun : 20 messages
- Format : `{ id, category, text }`

**Commit 4.3** : `feat(content): Implement LocalPackProvider`
- `/src/content/localPackProvider.ts` :
  - Charge happy-pack.json
  - `getItem(category?)` : sélection aléatoire
  - Vérifie anti-répétition via `sentRepo.wasSentRecently()`
  - Retry logic (max 10 tentatives) si tous récents

**Commit 4.4** : `feat(content): Implement QuoteAPI Provider with fallback`
- `/src/content/quoteApiProvider.ts` :
  - API : Quotable (https://api.quotable.io/random) ou ZenQuotes
  - Timeout : 3s
  - Fallback vers LocalPackProvider si échec
  - Transform API response en ContentItem

**Commit 4.5** : `feat(content): Add content filters and formatter`
- `/src/content/filters.ts` :
  - `isValidLength(text: string, maxLen: number)`
  - `containsBannedWords(text: string, blacklist: string[])`
  - Blacklist : injures, termes médicaux lourds, politique
- `/src/content/formatter.ts` :
  - `formatMessage(item: ContentItem, slot?: TimeSlot): string`
  - Templates : Kick-off, Reset, Citation
  - Limite emoji : 0-2 max

**Commit 4.6** : `feat(content): Create unified Content Provider with strategy pattern`
- `/src/content/provider.ts` :
  - Orchestrate Local + API providers
  - Ordre : API (si activé) → Local fallback
  - Applique filtres avant retour
  - Record dans sentRepo après envoi

**Critères de validation** :
- ✅ Local pack chargé sans erreur
- ✅ `/happy now` envoie messages variés du local pack
- ✅ API provider fonctionne avec fallback local si down
- ✅ Pas de répétition sur 30 jours (test avec 20 appels consécutifs)
- ✅ Filtres bloquent messages trop longs ou inappropriés

---

## Phase 5 : Scheduler Automatique

### Branche : `feature/scheduler`

**Objectif** : Publication programmée 2-3x/jour selon config guild avec node-cron.

#### Commits :

**Commit 5.1** : `feat(scheduler): Implement minute-check scheduler`
- `/src/scheduler/scheduler.ts` :
  - Cron job : `* * * * *` (chaque minute)
  - Check chaque guild_config active
  - Vérifie : jour actif + heure match + pas déjà envoyé dans les 2 dernières minutes

**Commit 5.2** : `feat(scheduler): Add slot-to-category mapping`
- `/src/scheduler/jobs.ts` :
  - Fonction `getSlotCategory(time: string, cadence: number): Category`
  - Mapping :
    - 09:15 → motivation/focus
    - 12:45 → wellbeing/fun (si cadence = 3)
    - 16:30 → wellbeing/team

**Commit 5.3** : `feat(scheduler): Implement sendScheduledMessage`
- `/src/scheduler/jobs.ts` :
  - `sendScheduledMessage(guildId: string, slot: string)`
  - Récupère config via guildConfigRepo
  - Appel content provider avec catégorie appropriée
  - Envoi dans canal configuré
  - Record dans sentRepo
  - Error handling (log si canal inaccessible)

**Commit 5.4** : `feat(scheduler): Add timezone support and scheduling logic`
- Conversion timezone (UTC → Europe/Paris par défaut)
- Support multi-guild avec timezones différentes
- Cache des "derniers envois" pour éviter doublons dans la même minute

**Commit 5.5** : `feat(scheduler): Integrate scheduler with bot lifecycle`
- `/src/index.ts` : démarrage scheduler après bot ready
- Graceful shutdown (stop cron on process exit)

**Critères de validation** :
- ✅ Messages envoyés automatiquement aux horaires configurés (09:15, 16:30)
- ✅ Respect des jours actifs (lun-ven par défaut)
- ✅ Pas de doublon dans la même minute
- ✅ Multi-guild supporté avec configs différentes
- ✅ Logs clairs en cas d'erreur (canal manquant, permissions)

---

## Phase 6 : Commandes Avancées

### Branche : `feature/advanced-commands`

**Objectif** : Implémenter `/happy test` et `/happy kudos`.

#### Commits :

**Commit 6.1** : `feat(commands): Implement /happy test command`
- `/src/commands/happyTest.ts` :
  - Admin only
  - Paramètre : `count` (1-5, défaut 3)
  - Envoie X messages variés
  - Affiche metadata (id, category, provider)
  - Mode dry-run (ne record pas dans sentRepo)

**Commit 6.2** : `feat(commands): Implement /happy kudos command`
- `/src/commands/happyKudos.ts` :
  - Paramètres : `user` (mention), `message` (optionnel, max 120 chars)
  - Cooldown par auteur : 5 min
  - Format stable : "🎉 Kudos à @X — [message]\nTu fais avancer la ruche. Merci."
  - Envoi dans canal configuré

**Commit 6.3** : `refactor(commands): Extract common command utilities`
- `/src/utils/commandHelpers.ts` :
  - `isAdmin(interaction): boolean`
  - `getGuildChannel(guildId, channelId): TextChannel | null`
  - `replyEphemeral(interaction, message)`

**Critères de validation** :
- ✅ `/happy test 5` affiche 5 messages différents
- ✅ `/happy kudos @user` envoie kudos avec format attendu
- ✅ Cooldown 5 min respecté sur kudos
- ✅ Commandes admin bloquées pour non-admins

---

## Phase 7 : Mode Contextuel (Optionnel — Post-V1)

### Branche : `feature/contextual-mode`

**Note** : Cette phase est **optionnelle** et peut être reportée après la V1 stable.

#### Commits :

**Commit 7.1** : `feat(listeners): Add onMessageCreate listener for contextual mode`
- `/src/listeners/onMessageCreate.ts` :
  - Activé uniquement si `contextual_enabled = 1`
  - Keywords : "stress", "down", "fatigué", "procrastine"
  - Cooldown strict : 6h par serveur
  - Réponse neutre + micro-action (pas de diagnostic)

**Commit 7.2** : `feat(bot): Update intents for contextual mode`
- Ajouter `MessageContent` intent (uniquement si mode activé)
- Toggle dynamique via settings

**Critères de validation** :
- ✅ Mode OFF par défaut (pas de MessageContent intent requis)
- ✅ Si activé : réponse max 1x/6h par guild
- ✅ Réponses neutres et bienveillantes

---

## Phase 8 : Tests, Documentation & Release V1

### Branche : `release/v1`

#### Commits :

**Commit 8.1** : `test: Add unit tests for repositories`
- Tests Jest pour guildConfigRepo, sentRepo, cooldownRepo
- Coverage > 80%

**Commit 8.2** : `test: Add integration tests for commands`
- Tests pour `/happy now`, `/happy settings`, `/happy kudos`
- Mock Discord interactions

**Commit 8.3** : `docs: Add README with setup and usage instructions`
- Installation (npm install)
- Configuration .env
- Création application Discord + token
- Lancement (npm run dev / npm start)
- Commandes disponibles

**Commit 8.4** : `docs: Add operational guide for local deployment`
- Guide PM2 pour run en background
- Auto-restart on crash
- Logs management
- Backup SQLite database

**Commit 8.5** : `chore: Prepare v1.0.0 release`
- Bump version package.json → 1.0.0
- Changelog
- Tag git : `v1.0.0`

**Critères de validation** :
- ✅ Tests passent (npm test)
- ✅ Build produit sans erreur (npm run build)
- ✅ Bot démarre et fonctionne 24h sans crash
- ✅ Documentation claire et complète
- ✅ .env.example à jour

---

## Workflow Git Recommandé

### Workflow de développement :

1. **Créer branche feature depuis main**
   ```bash
   git checkout main
   git pull
   git checkout -b feature/nom-feature
   ```

2. **Commits atomiques et descriptifs**
   - Préfixes : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
   - Messages en anglais (convention)
   - Exemple : `feat(scheduler): Add timezone support for multi-guild`

3. **Merge vers main**
   ```bash
   git checkout main
   git merge feature/nom-feature --no-ff
   git push origin main
   ```

4. **Tag de releases**
   ```bash
   git tag -a v1.0.0 -m "Release V1 - Happy Manager Bot"
   git push origin v1.0.0
   ```

### Branches principales :

- `main` : version stable, déployable
- `feature/*` : développement de fonctionnalités
- `fix/*` : corrections de bugs
- `release/*` : préparation releases (tests finaux, docs)

---

## Timeline Estimée

| Phase | Durée estimée | Livrable |
|-------|---------------|----------|
| 1. Setup | 1-2h | Projet TypeScript configuré |
| 2. Database | 2-3h | Schéma SQLite + repos fonctionnels |
| 3. Bot Core | 3-4h | Bot connecté + 2 commandes opérationnelles |
| 4. Content System | 4-5h | Local pack + API + filtres |
| 5. Scheduler | 3-4h | Publication automatique 2x/jour |
| 6. Advanced Commands | 2-3h | /test + /kudos |
| 7. Contextual (optionnel) | 2-3h | Mode contextuel |
| 8. Tests & Release | 3-4h | Tests + docs + release |

**Total (sans Phase 7)** : 18-25 heures de développement

**Total (avec Phase 7)** : 20-28 heures de développement

---

## Décisions Produit à Finaliser

### Avant lancement V1 :

1. **Nom du bot** : Sunny, Peppy, Joy, ou vote communauté ?
2. **Canal par défaut** : `#happy-manager` ou `#good-vibes` ou custom par guild ?
3. **API de citations** : Quotable.io (gratuit, 2000 req/jour) ou ZenQuotes (gratuit, illimité) ?

### Post-V1 (améliorations) :

4. **Pack local enrichissement** : 300 → 800 messages (contribution communauté ?)
5. **Contextual mode** : lancement en beta ou V2 ?
6. **Multi-langue** : support EN/FR ?
7. **Web dashboard** : interface config sans Discord (V2+) ?

---

## Notes Techniques Importantes

### Sécurité :
- ✅ `.env` dans `.gitignore` (JAMAIS commit token)
- ✅ Validation stricte inputs utilisateurs (SQL injection impossible avec better-sqlite3 prepared statements)
- ✅ Permissions Discord vérifiées avant actions sensibles

### Performance :
- ✅ SQLite en mode WAL (Write-Ahead Logging) pour concurrence
- ✅ Cache en mémoire pour guild configs (refresh toutes les 5 min)
- ✅ Timeout API : 3s max (fallback rapide)

### Maintenabilité :
- ✅ Architecture modulaire (separation of concerns)
- ✅ Types TypeScript stricts (pas de `any`)
- ✅ Logs structurés (Winston ou Pino)
- ✅ Versionning du schéma DB (migrations)

---

## Commandes de Démarrage Rapide

```bash
# Installation
npm install

# Configuration
cp .env.example .env
# Éditer .env avec DISCORD_TOKEN

# Développement
npm run dev

# Build production
npm run build

# Lancement production
npm start

# Avec PM2 (background)
pm2 start dist/index.js --name happy-manager
pm2 save
pm2 startup
```

---

**Prochaine étape** : Validation de ce plan → Phase 1 (Setup) → Itération progressive jusqu'à V1 opérationnelle.
