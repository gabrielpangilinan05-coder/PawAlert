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
