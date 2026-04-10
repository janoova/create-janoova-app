# create-janoova-app

Scaffold a new site from the [janoova-ui](https://github.com/janoova/janoova-ui) template — a Next.js + Sanity CMS starter.

---

## Requirements

- Node.js >= 18
- git

---

## Commands

### Create a new project

```bash
npx github:janoova/create-janoova-app <project-name>
```

Clones the latest `janoova-ui` template into a new `<project-name>` directory, walks you through setting up environment variables, runs `npm install`, and optionally seeds your Sanity dataset.

**What it does (step by step):**

1. Clones `janoova-ui` and removes the template's git history so your project starts fresh
2. Prompts for environment variables (you can skip any and fill them in `.env.local` later):
   - Organization Name
   - Sanity Project ID
   - Sanity Editor Token
   - Resend API Key (for emails)
   - Base URL (defaults to `https://your-site.vercel.app`)
3. Writes `.env.local` with your values
4. Runs `npm install`
5. Optionally seeds your Sanity `production` dataset from the janoova-ui template data

---

### Update an existing project's framework

```bash
npx github:janoova/create-janoova-app update [path]
```

Updates the janoova-ui framework files in an existing project without touching your site-specific content.

- `[path]` — path to the project directory (defaults to current directory)

**What it preserves:**

- `workspace/` — your Sanity schemas and config
- `.git/` — your git history
- `node_modules/`
- `.env.local` and `.env`
- Icon/favicon files inside `public/` and `app/` (e.g. `favicon.ico`, `icon.*`, `apple-icon.*`, `apple-touch-icon.png`)
- Your project's `name` in `package.json`

**What it updates:**

- All framework files from the latest `janoova-ui` release
- Runs `npm install` to pick up any dependency changes

---

## After creating a new project

```bash
cd <project-name>
npm run dev
```

Then open [http://localhost:3000/studio](http://localhost:3000/studio) and sign in.

### Manual steps

**Sanity** ([manage.sanity.io](https://manage.sanity.io))

- [ ] Create CORS origins for your site URLs
- [ ] Create the revalidate webhook (after deploying to Vercel)

**Design**

- [ ] Customize branding → `/workspace/theme.js`
- [ ] Replace favicon → `/public/`
- [ ] Update list-item checkmark in CSS

**Integrations**

- [ ] Update general contact form email notification
- [ ] Update CTA data for blog posts

**Deployment (Vercel)**

- [ ] Add all `.env.local` values as environment variables
- [ ] Set `NEXT_PUBLIC_BASE_URL` to your production domain
- [ ] Add domain to Sanity CORS after deploying
- [ ] Update revalidate webhook domain in Sanity
- [ ] Make sure "Disable Indexing" is **unchecked** in Sanity Studio

---

## Seed Sanity dataset manually

If you skipped the dataset seed during setup or need to re-run it:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx sanity dataset import master-template.tar.gz production --replace
```

---

## Initialize git for your new project

```bash
git init && git add . && git commit -m "Initial commit"
```
