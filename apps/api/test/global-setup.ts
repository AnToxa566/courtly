import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import './load-test-env';

// Applies every migration to courtly_test, including the hand-written
// constraints, so the tests run against the real schema. --no-install: use
// only the pinned local Prisma, never fetch another version from the registry.
export default function globalSetup(): void {
  execFileSync('npx', ['--no-install', 'prisma', 'migrate', 'deploy'], {
    cwd: join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
}
