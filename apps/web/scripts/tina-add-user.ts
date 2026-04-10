#!/usr/bin/env node

/**
 * Add or update a TinaCMS admin user.
 *
 * Usage:
 *   npx ts-node apps/web/scripts/tina-add-user.ts <username> <password> [role]
 *
 * Example:
 *   npx ts-node apps/web/scripts/tina-add-user.ts admin s3cretP@ss editor
 */

import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

interface User {
  username: string;
  passwordHash: string;
  role: string;
}

const USERS_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../tina/auth/users.json'
);

async function main() {
  const [, , username, password, role = 'editor'] = process.argv;

  if (!username || !password) {
    console.error(
      'Usage: npx ts-node apps/web/scripts/tina-add-user.ts <username> <password> [role]'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: password must be at least 8 characters');
    process.exit(1);
  }

  let users: User[] = [];
  if (fs.existsSync(USERS_PATH)) {
    users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
  }

  const existing = users.findIndex(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  const passwordHash = await bcrypt.hash(password, 12);

  if (existing >= 0) {
    users[existing]!.passwordHash = passwordHash;
    users[existing]!.role = role;
    console.log(`Updated user "${username}" (role: ${role})`);
  } else {
    users.push({ username, passwordHash, role });
    console.log(`Created user "${username}" (role: ${role})`);
  }

  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2) + '\n');
  console.log(`Users file: ${USERS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
