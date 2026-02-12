SPEC — Bot “Happy Manager” (frère/soeur de Grumpy)

1. Objectifs produit

1) Publier automatiquement des messages “good vibes” dans un canal dédié.
2) Permettre aux membres de déclencher un boost à la demande.
3) Permettre aux admins de configurer fréquence / horaires / canal sans toucher au code.
4) Garantir un contenu “safe” : pas de conseils médicaux/psy, pas de prosélytisme, pas de contenu adulte, pas d’injonctions culpabilisantes.
5) Éviter la répétition et le spam.

2. Non-objectifs

* Pas de “coach thérapeutique”.
* Pas de DM non sollicités.
* Pas de réponses automatiques sur tous les messages (optionnel, désactivé par défaut).
* Pas d’IA générative obligatoire. (On peut l’ajouter plus tard.)

3. Personas & ton

* “Happy Manager” : joyeux, dynamique, bienveillant, court, actionnable.
* Style : 1 idée = 1 message. 350 caractères max idéalement.
* Format recommandé : titre + 1 phrase + 1 micro-action.
  Ex : “Mini reset 🌿 — Inspire 4 secondes, expire 6. 3 fois. Reviens à ta tâche la plus simple.”

4. Scope fonctionnel

4.1. Publication programmée

* 2 posts / jour (par défaut) du lundi au vendredi :

  * 09:15 Europe/Paris : Kick-off (motivation/intention)
  * 16:30 Europe/Paris : Reset (pause/bilan)
* Option admin : passer à 3 posts/jour (ajoute 12:45 “micro-pause”)
* Option admin : activer/désactiver week-end
* Option admin : plage horaire (start/end) si on veut autoriser des horaires custom

4.2. Commandes (slash commands)
A) /happy now [category?]

* Poste immédiatement un message dans le canal configuré.
* category optionnelle : motivation | wellbeing | focus | team | fun
* Cooldown global : 60s (évite spam).

B) /happy settings (admin/mod uniquement)

* Affiche config actuelle
* Permet de définir :

  * canal cible
  * fréquence (2 ou 3/jour)
  * jours actifs (lun–ven par défaut)
  * heures (par défaut 09:15, 16:30, +12:45 si 3/jour)
  * toggle “réponses contextuelles” (OFF par défaut)

C) /happy test [count?]

* Admin only
* Envoie X messages (max 5) en mode “dry-run” dans un canal de test (ou le canal configuré) pour valider la variété.

D) /happy kudos @user [message?]

* Envoie un shout-out positif (format stable) dans canal configuré.
* message optionnel : 120 caractères max.
* Cooldown par auteur : 5 min.

4.3. Réponses contextuelles (optionnel)

* Désactivé par défaut.
* Si activé : écoute certains mots-clés (ex. “stress”, “down”, “fatigué”, “procrastine”).
* Répond au plus 1 fois toutes les 6 heures par serveur (cooldown strict).
* Réponse = message très neutre + micro-action, pas de diagnostic.

5. Contenu : sources & stratégie anti-répétition

5.1. “Providers” de contenu (ordre)
Provider 1 : Local Pack (obligatoire)

* Un fichier JSON/YAML de 300–800 messages.
* Réparti par catégories.
* 100% safe, stable, pas de dépendance réseau.

Provider 2 : API citations (optionnel)

* Appel HTTP vers une API de citations (free tier). Si échec → fallback local.
* Les citations doivent passer un filtre (longueur, mots bannis, pas de thèmes sensibles).

Provider 3 : RSS parse (optionnel)

* Parsing d’un flux “productivité / bien-être” très light.
* Prendre uniquement titres courts + lien (si c’est pertinent).
* Je le recommande seulement si vous avez une source fiable.

5.2. Stockage anti-répétition

* Objectif : ne pas repost un même “content_id” sur les 30 derniers jours.
* On stocke chaque envoi avec content_id + date + catégorie + canal.

5.3. Règles de filtrage

* Longueur max : 600 caractères (hard cap), idéalement < 350.
* Bannir : injures, contenu adulte, termes médicaux/dépressifs lourds, politiques.
* Pas de promesses (“guérir”, “soigner”), pas d’injonctions (“tu dois”), pas de culpabilisation.
* Emoji : ok, léger (0 à 2 max).

6. Données & stockage

6.1. Base de données
Option A (simple) : SQLite (recommandé)

* 1 fichier local.
* Suffisant pour un serveur.

Option B : Postgres (si plateforme serverless)

* Même schéma, driver différent.

6.2. Schéma (SQL)
Table guild_config

* guild_id TEXT PRIMARY KEY
* channel_id TEXT NOT NULL
* timezone TEXT NOT NULL DEFAULT 'Europe/Paris'
* cadence INTEGER NOT NULL DEFAULT 2   -- 2 ou 3
* active_days TEXT NOT NULL DEFAULT '1,2,3,4,5'  -- ISO dow 1=Mon … 7=Sun
* schedule_times TEXT NOT NULL DEFAULT '09:15,16:30' -- si cadence=3: '09:15,12:45,16:30'
* contextual_enabled INTEGER NOT NULL DEFAULT 0
* created_at DATETIME NOT NULL
* updated_at DATETIME NOT NULL

Table sent_messages

* id INTEGER PRIMARY KEY AUTOINCREMENT
* guild_id TEXT NOT NULL
* channel_id TEXT NOT NULL
* content_id TEXT NOT NULL
* category TEXT NOT NULL
* provider TEXT NOT NULL
* sent_at DATETIME NOT NULL

Index :

* idx_sent_guild_date (guild_id, sent_at)
* unique_recent (guild_id, content_id) (optionnel, ou géré app-side)

Table cooldowns (optionnel si vous gardez en mémoire)

* key TEXT PRIMARY KEY
* value DATETIME NOT NULL
  Ex: key="guild:<id>:now" / "guild:<id>:context"

7. API Discord & permissions

* Scopes OAuth2 :

  * bot
  * applications.commands
* Intents :

  * Guilds
  * GuildMessages (uniquement si contextual_enabled)
  * MessageContent (uniquement si contextual_enabled, sinon inutile)
* Permissions bot :

  * Send Messages
  * Embed Links (optionnel)
  * Read Message History (optionnel)

8. Architecture code (TypeScript)

8.1. Arborescence
/src
/bot
client.ts
registerCommands.ts
/commands
happyNow.ts
happySettings.ts
happyTest.ts
happyKudos.ts
/scheduler
scheduler.ts
jobs.ts
/content
provider.ts
localPackProvider.ts
quoteApiProvider.ts
filters.ts
formatter.ts
/db
db.ts
migrations.ts
guildConfigRepo.ts
sentRepo.ts
cooldownRepo.ts
/config
env.ts
constants.ts
/listeners
onMessageCreate.ts   (contextual)
index.ts

/data
happy-pack.json

8.2. Interfaces clés
ContentItem

* id: string
* category: 'motivation'|'wellbeing'|'focus'|'team'|'fun'
* text: string
* tags?: string[]
* source?: string
* provider: 'local'|'api'|'rss'

ContentProvider

* getItem(category?: Category): Promise<ContentItem>

Repos

* getGuildConfig(guildId)
* upsertGuildConfig(...)
* recordSent(item,...)
* wasSentRecently(guildId, contentId, days=30): boolean
* getCooldown(key), setCooldown(key, until)

8.3. Scheduler

* lib : node-cron ou cron (npm) ou “bree” (plus lourd).
* On calcule les prochaines exécutions par guild_config (multi-serveur friendly).
* Stratégie simple :

  * Un cron par minute qui check : “est-ce qu’il est HH:MM maintenant ?” et active day ?
  * Si oui → sendScheduledMessage(guildId, slot)
    Avantage : pas besoin de reprogrammer des crons à la volée.

Pseudo :
everyMinute:
now = current time in tz
for each guild_config:
if day matches and now in schedule_times and not already sent in last 2 min:
send(category slot mapping)

Slot mapping par défaut :

* 09:15 → motivation/focus
* 12:45 → wellbeing/fun (si cadence=3)
* 16:30 → wellbeing/team (reset + gratitude)

9. UX / formatting des messages

* Format standard (lisible) :
  Titre + corps + micro-action.
  Ex :
  “Kick-off ☀️
  Choisis 1 tâche qui fera gagner la journée.
  Micro-action : note-la, puis démarre 10 minutes.”

* Pour citations :
  “Petite dose de recul ✨
  « … »
  Micro-action : applique-la sur ta tâche la plus difficile.”

* /kudos :
  “🎉 Kudos à @X — [message]
  Tu fais avancer la ruche. Merci.”

10. Tests & critères d’acceptation

10.1. Tests minimaux (unit)

* filters.ts :

  * refuse si longueur > cap
  * refuse si blacklist match
* anti-répétition :

  * si content_id envoyé < 30 jours → skip et pick autre
* scheduler “slot detection” :

  * pour une config donnée, HH:MM déclenche bien

10.2. Critères d’acceptation

* Le bot poste 2x/jour aux horaires définis dans le canal configuré.
* /happy now fonctionne, respecte cooldown, poste dans bon canal.
* /happy settings est accessible seulement aux admins/mods.
* Pas de répétition d’un même content_id sur 30 jours (au moins via local pack).
* Si API down → fallback local sans erreur visible.
* Aucun message ne dépasse 600 caractères.
* Contextual mode OFF par défaut et ne requiert pas MessageContent intent.

11. Déploiement & opérations

* Variables d’environnement :

  * DISCORD_TOKEN
  * DATABASE_URL (si Postgres) ou SQLITE_PATH
  * DEFAULT_TIMEZONE=Europe/Paris
  * QUOTE_API_URL (optionnel)
  * QUOTE_API_KEY (optionnel)
* Logs : console + rotation (plateforme)
* Monitoring : ping /health (express minimal) optionnel
* Redémarrage auto : via plateforme

12. Plan de livraison (ordre)

13. Bot baseline + slash commands (now, settings) + DB config

14. Scheduler minute-check + 2 slots

15. Local pack provider + anti-répétition

16. /kudos + /test

17. Provider API citations (optionnel)

18. Contextual listener (optionnel)

19. Bonus : “pack” de messages

* On démarre avec 200 messages local (50 par catégorie) puis on enrichit.
* Règle : 1 JSON stable, versionné git.

Exemple format happy-pack.json
[
{ "id":"mot-001", "category":"motivation", "text":"Kick-off ☀️\nChoisis 1 tâche qui rendra ta journée plus légère.\nMicro-action : démarre 10 minutes maintenant." },
{ "id":"wb-001", "category":"wellbeing", "text":"Reset 🌿\nRelâche les épaules. Respire plus lentement 3 fois.\nMicro-action : bois 3 gorgées d’eau." }
]

14. Décision produit à trancher (sans bloquer)

* Nom final du bot (Sunny/Peppy/etc.)
* Canal par défaut (#happy-manager ou #good-vibes)
* Est-ce qu’on autorise les week-ends (par défaut non)
* Contextual mode : OFF par défaut (je recommande de le garder OFF au lancement)
