import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const build = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build', '--webpack'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    GITHUB_PAGES_BUILD: 'true',
    NEXT_PUBLIC_BASE_PATH: '/kumovya-clicker',
    NEXT_TELEMETRY_DISABLED: '1',
  },
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
writeFileSync(new URL('../out/.nojekyll', import.meta.url), '');

const verification = spawnSync(process.execPath, ['scripts/verify-github-pages.mjs'], {
  cwd: projectRoot,
  stdio: 'inherit',
});
if (verification.error) throw verification.error;
process.exit(verification.status ?? 1);
