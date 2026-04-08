#!/usr/bin/env node

/**
 * create-janoova-app
 * Scaffolds a new site by cloning janoova-ui from GitHub.
 *
 * Usage:
 *   npx github:janoova/create-janoova-app my-new-site
 */

import { existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { createInterface } from 'readline';
import { spawnSync } from 'child_process';

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

// ─── main ─────────────────────────────────────────────────────────────────────

const TEMPLATE_REPO = 'https://github.com/janoova/janoova-ui.git';

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

const sanityProjectId  = await prompt(rl, 'Sanity Project ID');
const sanityToken      = await prompt(rl, 'Sanity Editor Token');
const resendApiKey     = await prompt(rl, 'Resend API Key (emails)');
const baseUrl          = await prompt(rl, 'Base URL', 'https://your-site.vercel.app');

rl.close();

// ─── write .env.local ─────────────────────────────────────────────────────────

log.step('3/4  Writing .env.local');

const envLines = [
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
  rl2.question(`  ${c.cyan}?${c.reset} Import Sanity dataset now? ${c.dim}(y/N)${c.reset}: `, (ans) => {
    resolve(ans.trim().toLowerCase() === 'y');
  });
});
rl2.close();

if (importDataset) {
  log.step('Importing Sanity dataset');

  const tarPath = join(process.cwd(), 'master-template.tar.gz');
  if (!existsSync(tarPath)) {
    log.warn('master-template.tar.gz not found in current directory.');
    log.dim('Export it from janoova-ui first:');
    log.dim('  npx sanity dataset export production master-template.tar.gz');
    log.dim('Then run from your new project:');
    log.dim('  NODE_OPTIONS="--max-old-space-size=4096" npx sanity dataset import master-template.tar.gz production --replace');
  } else {
    log.info('Found master-template.tar.gz — importing...\n');
    const importResult = spawnSync(
      'node',
      ['--max-old-space-size=4096', 'node_modules/.bin/sanity', 'dataset', 'import', tarPath, 'production', '--replace'],
      { cwd: targetDir, stdio: 'inherit', shell: false }
    );
    if (importResult.status === 0) {
      log.success('Dataset imported');
    } else {
      log.warn('Dataset import failed — you can run it manually later.');
    }
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
  [ ] Update general contact form (Formspark)
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
