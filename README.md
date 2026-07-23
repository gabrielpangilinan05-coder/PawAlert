# PawAlert

Instant networks for missing pets — **Next.js** (TypeScript + React).

## Requirements

- Node.js 20+
- XAMPP MySQL with database `pawalert`

## Setup

```bat
cd c:\xampp\htdocs\PawAlert
npm install
copy .env.example .env.local
```

## Fast mode (recommended)

Double-click **`start-fast.bat`** or run:

```bat
npm run fast
```

This builds once, then serves without “Compiling…”. Much faster than `npm run dev`.

## Development

```bat
npm run dev
```

Open http://localhost:3000

Dev is slower: first visit to each page compiles on demand.

## Production SMS (Semaphore)

Signup OTP uses SMS via [Semaphore](https://semaphore.co).

| Env | Local | Vercel Production |
| --- | --- | --- |
| `SMS_DEV_MODE` | `true` (code in console / verify UI) | `false` |
| `SEMAPHORE_API_KEY` | optional | **required** |
| `SEMAPHORE_SENDER` | optional | approved sender name (e.g. `PawAlert`) |

After changing Vercel env vars, redeploy (`npx vercel --prod`).

## Custom domain

1. Buy a domain (Vercel Domains, Namecheap, Cloudflare, etc.).  
   Note: `.ph` is often bought from a PH registrar; Vercel may not sell it.
2. Vercel → **pawalert** → **Settings → Domains** → Add `yourdomain.com` (and `www`).
3. Point DNS as Vercel instructs (A/CNAME), wait for SSL.
4. Set Production env:
   ```
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```
5. Redeploy so QR, share, and OG links use the custom host.

## Install on phone (PWA)

Production is installable (manifest + service worker):

- **Android Chrome:** menu → **Install app** / **Add to Home screen**
- **iPhone Safari:** Share → **Add to Home Screen**

Use HTTPS (Vercel). Local `localhost` can also install in Chrome for testing.

## Rate limits & admin moderation

API write routes return **429** when abused (login/register/OTP, posts, pets, likes, comments, chat, shares, reports). Limits are in-memory per server instance.

Moderation:

1. Run `sql/migration_moderation.sql` on local **and** production MySQL.
2. Your account is admin if `users.role = 'admin'`, or listed in `ADMIN_EMAILS`.
3. Open `/admin` to hide/delete posts, ban users, and close reports.
4. Feed users can **Report** a post from the social card actions.

```bat
C:\xampp\mysql\bin\mysql.exe -u root pawalert < sql\migration_moderation.sql
```
