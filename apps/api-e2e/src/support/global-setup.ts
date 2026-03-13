import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */

module.exports = async function () {
  console.log('\nSetting up...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await waitForPortOpen(port, { host });

  (globalThis as Record<string, unknown>).__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
