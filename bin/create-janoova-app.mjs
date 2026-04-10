#!/usr/bin/env node

/**
 * create-janoova-app
 * Scaffolds a new site by cloning janoova-ui from GitHub.
 *
 * Usage:
 *   npx github:janoova/create-janoova-app my-new-site
 */

import { existsSync, writeFileSync, readFileSync, createWriteStream, unlinkSync, readdirSync, cpSync, rmSync } from 'fs';
import { resolve, join, relative, sep } from 'path';
import { createInterface } from 'readline';
import { spawnSync } from 'child_process';
import { get as httpsGet } from 'https';
import { tmpdir } from 'os';

// ─── helpers ────────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

const log = {
  info:    (msg) => console.log(`${c.cyan}  >${c.reset} ${msg}`),
  success: (msg) => console.log(`${c.green}  ✓${c.reset} ${msg}`),
  warn:    (msg) => console.log(`${c.yellow}  ⚠${c.reset} ${msg}`),
  error:   (msg) => console.log(`${c.red}  ✗${c.reset} ${msg}`),
  step:    (msg) => console.log(`\n${c.bold}${c.blue}  ${msg}${c.reset}`),
  dim:     (msg) => console.log(`${c.dim}    ${msg}${c.reset}`),
};

function prompt(rl, question, defaultValue = '') {
  const hint = defaultValue ? ` ${c.dim}(${defaultValue})${c.reset}` : '';
  return new Promise((resolve) => {
    rl.question(`  ${c.cyan}?${c.reset} ${question}${hint}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

// ─── download helper (follows redirects) ─────────────────────────────────────

const SEED_URL = 'https://github.com/janoova/janoova-ui/releases/latest/download/master-template.tar.gz';

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    const fetch = (u) => {
      httpsGet(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          fetch(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} — no seed dataset release found`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      }).on('error', reject);
    };
    fetch(url);
  });
}

// ─── update ───────────────────────────────────────────────────────────────────

const TEMPLATE_REPO = 'https://github.com/janoova/janoova-ui.git';

if (process.argv[2] === 'update') {
  const targetDir = process.argv[3]
    ? resolve(process.cwd(), process.argv[3])
    : process.cwd();

  console.log(`\n${c.bold}${c.magenta}  create-janoova-app update${c.reset}\n`);

  if (!existsSync(join(targetDir, 'workspace'))) {
    log.error(`No workspace/ folder found at "${targetDir}" — is this a janoova-ui project?`);
    process.exit(1);
  }

  // Save the project's package name before overwriting
  const pkgPath = join(targetDir, 'package.json');
  const currentPkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const savedName = currentPkg.name;

  // Clone latest framework to a temp dir
  const tmpDir = join(tmpdir(), `janoova-update-${Date.now()}`);

  log.step('1/3  Fetching latest janoova-ui');
  log.dim(`From: ${TEMPLATE_REPO}\n`);

  const clone = spawnSync('git', ['clone', '--depth=1', TEMPLATE_REPO, tmpDir], { stdio: 'inherit' });
  if (clone.status !== 0) {
    log.error('Clone failed. Check your internet connection and GitHub access.');
    process.exit(1);
  }
  log.success('Latest framework cloned');

  // Items to never overwrite from the template
  const PRESERVE_ROOT = new Set(['workspace', '.git', 'node_modules', '.env.local', '.env']);

  // Favicon-like files sitting directly in public/ (not in subdirs)
  const isFaviconFile = (srcBase, srcPath) => {
    const rel = relative(srcBase, srcPath);
    const parts = rel.split(sep);
    if (parts.length !== 1) return false;
    return /^favicon/i.test(parts[0]) || /^icon\./i.test(parts[0]) || parts[0] === 'apple-touch-icon.png';
  };

  log.step('2/3  Updating framework files');

  for (const entry of readdirSync(tmpDir)) {
    if (entry === '.git') continue;          // never copy template git history
    if (PRESERVE_ROOT.has(entry)) continue;  // skip site-specific items

    const src  = join(tmpDir, entry);
    const dest = join(targetDir, entry);

    if (entry === 'public') {
      // Copy public/ but leave any existing favicon* / apple-touch-icon files alone
      cpSync(src, dest, {
        recursive: true,
        force: true,
        filter: (srcPath) => !isFaviconFile(src, srcPath),
      });
    } else {
      cpSync(src, dest, { recursive: true, force: true });
    }
  }

  // Restore project name and drop the template's bin entry
  const newPkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  newPkg.name = savedName;
  delete newPkg.bin;
  writeFileSync(pkgPath, JSON.stringify(newPkg, null, 2) + '\n');

  // Remove temp clone
  rmSync(tmpDir, { recursive: true, force: true });
  log.success('Framework files updated');

  // Reinstall deps to pick up any package.json changes
  log.step('3/3  Updating dependencies');
  log.dim('Running npm install...\n');

  const install = spawnSync('npm', ['install'], { cwd: targetDir, stdio: 'inherit', shell: true });
  if (install.status !== 0) {
    log.warn('npm install had issues — check the output above.');
  } else {
    log.success('Dependencies updated');
  }

  console.log(`\n${c.bold}${c.green}  Done! "${savedName}" is up to date.${c.reset}\n`);
  process.exit(0);
}

// ─── main ─────────────────────────────────────────────────────────────────────

const projectName = process.argv[2];

console.log(`\n${c.bold}${c.magenta}  create-janoova-app${c.reset}\n`);

if (!projectName) {
  log.error('Please provide a project name.');
  log.dim('Usage: npx github:janoova/create-janoova-app <project-name>');
  process.exit(1);
}

const targetDir = resolve(process.cwd(), projectName);

if (existsSync(targetDir)) {
  log.error(`Directory "${projectName}" already exists. Choose a different name or remove it first.`);
  process.exit(1);
}

// ─── check git is available ───────────────────────────────────────────────────

const gitCheck = spawnSync('git', ['--version'], { stdio: 'pipe' });
if (gitCheck.status !== 0) {
  log.error('git is not installed or not in PATH. Please install git and try again.');
  process.exit(1);
}

// ─── clone template ───────────────────────────────────────────────────────────

log.step('1/4  Cloning janoova-ui template');
log.dim(`From: ${TEMPLATE_REPO}`);
log.dim(`To:   ${targetDir}\n`);

const clone = spawnSync(
  'git',
  ['clone', '--depth=1', TEMPLATE_REPO, targetDir],
  { stdio: 'inherit' }
);

if (clone.status !== 0) {
  log.error('Failed to clone template. Check your internet connection and GitHub access.');
  process.exit(1);
}

// Remove the .git folder so the new project starts fresh
spawnSync('rm', ['-rf', join(targetDir, '.git')], { stdio: 'inherit' });
log.success('Template cloned and git history cleared');

// ─── gather env values ────────────────────────────────────────────────────────

log.step('2/4  Environment variables');
log.dim('Press Enter to skip — you can fill these in .env.local later.\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });

const organizationName = await prompt(rl, 'Organization Name');
const sanityProjectId  = await prompt(rl, 'Sanity Project ID');
const sanityToken      = await prompt(rl, 'Sanity Editor Token');
const resendApiKey     = await prompt(rl, 'Resend API Key (emails)');
const baseUrl          = await prompt(rl, 'Base URL', 'https://your-site.vercel.app');

rl.close();

// ─── write .env.local ─────────────────────────────────────────────────────────

log.step('3/4  Writing .env.local');

const envLines = [
  `NEXT_PUBLIC_ORGANIZATION_NAME = "${organizationName}"`,
  `NEXT_PUBLIC_SANITY_PROJECT_ID = ${sanityProjectId}`,
  `SANITY_TOKEN = ${sanityToken}`,
  `NEXT_PUBLIC_SANITY_HOOK = revalidatewebhook`,
  `NEXT_PUBLIC_BASE_URL = ${baseUrl}`,
  ``,
  `# Resend (email)`,
  `RESEND_API_KEY = ${resendApiKey}`,
  ``,
  `# Below ones only needed locally`,
  `NEXT_PUBLIC_VERCEL_URL = "your-site.vercel.app"`,
  `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = "your-site.vercel.app"`,
];

writeFileSync(join(targetDir, '.env.local'), envLines.join('\n') + '\n');
log.success('.env.local written');

// ─── update package.json name ─────────────────────────────────────────────────

const pkgPath = join(targetDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.name = projectName;
// Remove the bin entry — it belongs to the template, not a new project
delete pkg.bin;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
log.success('package.json updated');

// ─── npm install ──────────────────────────────────────────────────────────────

log.step('4/4  Installing dependencies');
log.dim('Running npm install — this may take a minute...\n');

const install = spawnSync('npm', ['install'], {
  cwd: targetDir,
  stdio: 'inherit',
  shell: true,
});

if (install.status !== 0) {
  log.error('npm install failed. Check the output above.');
  process.exit(1);
}

log.success('Dependencies installed');

// ─── optional: dataset import ─────────────────────────────────────────────────

console.log('');
const rl2 = createInterface({ input: process.stdin, output: process.stdout });

const importDataset = await new Promise((resolve) => {
  rl2.question(`  ${c.cyan}?${c.reset} Seed Sanity dataset from janoova-ui template? ${c.dim}(y/N)${c.reset}: `, (ans) => {
    resolve(ans.trim().toLowerCase() === 'y');
  });
});
rl2.close();

if (importDataset) {
  log.step('Seeding Sanity dataset');

  const tarPath = join(tmpdir(), 'janoova-master-template.tar.gz');

  log.info('Downloading seed dataset from GitHub...');
  try {
    await download(SEED_URL, tarPath);
    log.success('Seed dataset downloaded');
  } catch (err) {
    log.error(`Download failed: ${err.message}`);
    log.dim('Make sure a release with master-template.tar.gz exists at:');
    log.dim('  https://github.com/janoova/janoova-ui/releases');
    log.dim('Or run the import manually later:');
    log.dim('  NODE_OPTIONS="--max-old-space-size=4096" npx sanity dataset import master-template.tar.gz production --replace');
    process.exit(0);
  }

  log.info('Importing into Sanity...\n');
  const importResult = spawnSync(
    'node',
    ['--max-old-space-size=4096', 'node_modules/.bin/sanity', 'dataset', 'import', tarPath, 'production', '--replace'],
    { cwd: targetDir, stdio: 'inherit', shell: false }
  );

  try { unlinkSync(tarPath); } catch {}

  if (importResult.status === 0) {
    log.success('Dataset seeded');
  } else {
    log.warn('Import failed — you can run it manually later.');
  }
}

// ─── done ─────────────────────────────────────────────────────────────────────

console.log(`
${c.bold}${c.green}  Done! "${projectName}" is ready.${c.reset}

${c.bold}  Next steps:${c.reset}

  ${c.cyan}cd ${projectName}${c.reset}
  ${c.cyan}npm run dev${c.reset}
  Then open ${c.cyan}http://localhost:3000/studio${c.reset} and sign in.

${c.bold}  Manual steps remaining:${c.reset}

  ${c.yellow}Sanity dashboard (manage.sanity.io)${c.reset}
  [ ] Create CORS origins for your site URLs
  [ ] Create the revalidate webhook (after deploying to Vercel)

  ${c.yellow}Design${c.reset}
  [ ] Customize branding → /workspace/theme.js
  [ ] Replace favicon → /public/
  [ ] Update list-item checkmark in CSS

  ${c.yellow}Integrations${c.reset}
  [ ] Update general contact form email notification
  [ ] Update CTA data for blog posts

  ${c.yellow}Deployment (Vercel)${c.reset}
  [ ] Add all .env.local values as environment variables
  [ ] Set NEXT_PUBLIC_BASE_URL to your production domain
  [ ] Add domain to Sanity CORS after deploying
  [ ] Update revalidate webhook domain in Sanity
  [ ] Make sure "Disable Indexing" is ${c.bold}unchecked${c.reset} in Sanity Studio

  ${c.yellow}SEO${c.reset}
  [ ] Update robots.txt disallow rule

${c.dim}  Tip: run "git init && git add . && git commit -m 'Initial commit'" when ready.${c.reset}
`);
