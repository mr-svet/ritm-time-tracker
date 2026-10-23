**English** · [Русский](README.ru.md) · [简体中文](README.zh-CN.md)

# Ritm — understand where your time goes

[![Actual Ritm interface — click to try the visitor demo](assets/github-preview.png)](https://ritmday.space/)

Actual interface screenshot · [Explore the live visitor demo](https://ritmday.space/) without a password.

## Try the live demo

[Open Ritm in your browser](https://ritmday.space/) to see how it looks and works — no installation required. Select **Visitor** on the sign-in screen to explore the time journal, charts and settings with sample data. Visitor mode opens without a password.

Ritm is a self-hosted time journal with a website, a SQLite database and an optional Telegram bot. A short check-in every 30 minutes helps you notice where your day goes, without turning every moment into a productivity contest.

Write a few words on the website or reply in Telegram. Your entries become a timeline, a time breakdown and daily or monthly trends. No ChatGPT account, AI API or language-model subscription is needed.

**Each installation has its own database.** Cloning this repository does not connect your journal to the author's server. Use your own bot token if you enable Telegram.

## What you can do

- Log activities from the website or Telegram, with check-ins every 15, 30 or 60 minutes during your chosen hours and days.
- At the start of a scheduled day, the bot asks when you woke up. Choose **Just now** or **Another time** and enter HH:MM; activity questions follow from the recorded wake-up time. Tap **Sleep** to record bedtime and stop questions for the day. Both exact times appear in the overview without adding to category totals.
- Keep several activities in one interval without overwriting earlier messages or counting the same minutes twice.
- Edit past entries and individual activities, split intervals, or fill gaps later.
- Create, rename, reorder, color, archive or delete categories; deleting a category keeps past activities as uncategorized and removes it from future bot choices.
- Set a 0–100% weight for each category; see total time in each date-by-category cell, then open it for intervals and activity descriptions.
- Search a broad city list to choose your time zone. Past days retain their original schedule and time zone.
- Switch between English and Russian, and between light and dark themes, on desktop or mobile.
- Give visitors a separate, passwordless demo with twelve rolling months of varied sample data, occasional missed check-ins and wake/bedtime marks, eight categories and three projects.
- Choose a day, week or month in Statistics; turn optional project fields and charts on or off without losing existing project links.
- Use **Settings → Language** in the Telegram bot to change its language.
- Export or import JSON, download filtered CSV files and create verified SQLite backups.

## Get started locally

Requires **Node.js 22.18 or later**. There are no third-party runtime dependencies to install.

```bash
git clone https://github.com/mr-svet/ritm.git
cd ritm
npm run setup
npm start
```

Open **[http://127.0.0.1:4173/](http://127.0.0.1:4173/)**.

`setup` creates the owner account and shows a random password once. Save it in a password manager. Running setup again does not change an existing password. To generate a new owner password and end active sessions while keeping journal entries, run `npm run reset-password`.

Keep the server running while you use the journal. Stop it with **Ctrl+C**. If another process is using port 4173, stop that process or choose another port:

```bash
PORT=4174 npm start
```

Local mode listens on `127.0.0.1`, so it is accessible only from the machine running it. To use the journal from other devices or keep the bot running when your computer is off, host it on an always-on server.

## Connect your own Telegram bot

1. Open the official [@BotFather](https://t.me/BotFather), send `/newbot` and follow its instructions. For local development, use a separate bot without a configured webhook.
2. Copy [`.env.example`](.env.example) to `.env` if that file does not already exist. Add your token locally:

   ```dotenv
   TELEGRAM_BOT_TOKEN=your_botfather_token
   ```

3. Restart `npm start`. The website and database also work without a bot token.
4. Sign in as the owner and open **Settings → Telegram → Connect Telegram**. Open the one-time link and press **Start** in Telegram. The link expires after 10 minutes.
5. Choose your time zone, tracking hours and days, then save your schedule. If today already has entries or breaks, schedule changes take effect tomorrow.

The token stays on the server. Keep `.env`, database files and backups out of Git, screenshots and shared messages. Run only **one bot process per token**; stop a local instance before using that token on your server.

### How check-ins work

A scheduled question asks about the interval that just ended, even if you already logged something for it. Choose a category; the bot confirms your choice. For **Work**, when projects are enabled, you can tap a project to record its name as the activity, or tap **My own answer** and write a description. For other categories, write a short description. You may select a different category using the original buttons before saving. After it is saved, those buttons disappear and the bot replies “Saved”. The selection is tied to that question and lasts 30 minutes. Additional categories are available through the bot's pagination button.

A normal message without a question-specific reply refers to the **current interval**, using its send time and your journal's time zone. With a 30-minute step, a message sent at 12:20 belongs to 12:00–12:30. After a completed bot check-in, the next normal message asks you to choose a category before it is saved. Repeated activities within an interval are appended; they do not replace earlier text or fill old gaps. Replies to a particular question stay attached to that question's interval. A scheduled answer can append to an activity you entered earlier for the same interval.

A reply also appends to an existing website entry for the same interval. Its project is preserved; an explicitly selected category applies to the whole interval. Individual activity durations are not guessed, and interval time is counted once. Partially overlapping or split intervals can be edited on the website.

The continue button repeats only the last individual activity, not the previous interval’s combined summary. Repeated clicks do not add the same continuation again. Replies to used, expired or unrecognized category requests are rejected instead of silently assigned to the current interval. Selecting a new category replaces any unfinished category selection; it does not copy previous activities.

| Command | Action |
| --- | --- |
| `/help` | Show help |
| `/settings` | Open bot settings and change language |
| `/sleep` | Record bedtime and stop today's questions |
| `/pause` | Pause reminders for an hour |
| `/resume` | Resume reminders |
| `/end` | Pause tracking for the rest of today |
| `/site` | Open the website |

Keyboard dictation works as ordinary text. Voice recordings are not transcribed. Use `/language` in Telegram to switch the bot between Russian and English. The website language is a separate preference.

The website checks for updates every five seconds while you are not editing a form. Pauses and days off are respected; missed intervals stay empty. The bot does not send a backlog of old questions after downtime. Delivery and reply statuses are shown separately in Settings.

## Your journal and trends

Quick check-in follows the current interval in your selected time zone and updates its time without clearing your draft. You can adjust the time manually. Past entries keep their original dates and times. You can save the current interval before it ends; intervals entirely in the future are rejected.

**Journal → All entries** opens the history. Use the edit button to change an entry or expand its activities to edit individual messages. Category and project apply to the whole interval.

**Overview**, the second navigation item, shows total time for each category and day. It opens from the same date in the previous month through today; scroll horizontally to see earlier dates, with the latest date anchored beside the categories. Click a duration to see its intervals and activity descriptions. Click wake-up or bedtime to correct its exact time, or click + to fill in a missing mark. The bottom row totals each day's logged time without counting multiple messages in an interval twice. Drag categories or use the arrow controls to reorder them; the bot uses the same order. The former productivity score is hidden from this screen.

Russian is the default website language; English is available from the language switch. Language, theme and day-scene preferences are saved on the device under `ritm-ui-v2`, separately from the journal. Switching languages does not translate or rewrite your personal entries or category names. Dates, durations, city labels and CSV headers follow the interface language.

**Check connection** checks the website server and shows a success message or an error. It does not check the Telegram connection or start the server.

## Visitor preview

The sign-in page has **Owner** and **Visitor** modes. Choose **Visitor → Open demo**; no password or account is needed.

Visitors receive a fresh, fictional journal. They can explore entries, categories, projects, schedules and charts. Changes stay in that tab's memory and disappear on reload; journal data is not read from or written to browser storage or the owner's database. Device language and theme preferences are stored separately.

Visitors cannot access the personal journal API, exports, imports or the live Telegram bot. These restrictions are enforced by the server, not just by hidden buttons. Visitor sessions last up to two hours; owner sessions last up to 12 hours.

One browser profile has one current role. Use separate browser profiles to test owner and visitor access at the same time.

## Data and backups

The default database file is **`data/rhythm.sqlite`**. `DATA_DIR` can change its directory. The `entries` table stores interval records; `entries.activities` contains the individual activities as JSON, including IDs, text and available UTC message timestamps. See [STAGE-2.md](STAGE-2.md) for backend details in Russian.

```bash
npm run db:entries
npm run db:backup
```

The first command lists recent entries without modifying the database. The second creates a SQLite snapshot and checks its integrity, including committed WAL data, while the app is running. Backups go to `backups/` by default, or the directory specified by `BACKUP_DIR`. Keep a separate copy outside the server as well.

Do not copy only the `.sqlite` file from a running database. For a manual filesystem backup, stop the app first and copy the entire `data/` directory, including any remaining WAL files.

JSON exports preserve activities and support importing older version-1 journals. CSV exports use one row per interval so durations are not duplicated. Exports and SQLite files are **not encrypted**.

An older browser-only personal journal is not migrated automatically. Use **Settings → Move from browser** on the same address and port, or export JSON from the old version and import it into the server journal. Download a backup before replacing data. Earlier messages overwritten by old versions cannot be reconstructed automatically.

## Browser-only preview

```bash
npm run dev
```

This runs a static frontend with browser storage under `ritm-local-v1`. It has no database API or live bot. `ritm-preview.html` is the standalone HTML version of this mode; rebuild it with `npm run build`. It is separate from the isolated visitor preview served by the backend.

## Hosting

The included [Dockerfile](Dockerfile) and [compose.yaml](compose.yaml) target **Dokploy with Docker Compose**. The Compose file expects an existing `dokploy-network`; it is not a standalone public-server configuration.

Use your own HTTPS domain and set `APP_ORIGIN` to that exact origin. Configure your own bot token through the server's environment settings. Keep the SQLite and backup volumes persistent and run a single application instance. HTTPS must terminate at the reverse proxy; do not publish the application's internal port directly.

Passwords are stored as salted scrypt hashes. Production sessions use Secure, HttpOnly, SameSite cookies, with origin and CSRF checks. Protect the host, disk and backups too; authentication does not encrypt the stored journal.

See [DEPLOYMENT.md](DEPLOYMENT.md) for release status and remaining verification work in Russian. The application supports one owner with visitor previews, not public registration or multiple independent user accounts. A Telegram Mini App is not implemented.

## Development

```bash
npm run check
npm test
npm run build
```

Tests use temporary databases and a simulated Telegram transport. They do not send real Telegram messages or modify your personal journal. Rebuild the standalone HTML after changing frontend modules or styles.

For product scope, see [PRD.md](PRD.md) in Russian. Automated tests do not replace checking delivery and replies with your own live bot.
