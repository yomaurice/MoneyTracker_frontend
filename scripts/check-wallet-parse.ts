// Holds the /add page's notification parser to the same fixtures as the
// backend's. Run from MoneyTracker_frontend:
//   node --experimental-strip-types scripts/check-wallet-parse.ts
import { readFileSync } from 'node:fs';

import { parseNotification } from '../src/utils/walletParse.ts';

const fixtures = JSON.parse(
  readFileSync(
    new URL('../../backend/tests/fixtures/wallet_notifications.json', import.meta.url),
    'utf8',
  ),
);

let failed = 0;
for (const c of fixtures.cases) {
  const got = parseNotification(c.title, c.text);
  const ok = JSON.stringify(got) === JSON.stringify(c.expect);
  if (!ok) {
    failed++;
    console.log(`FAIL ${c.name}\n  expected ${JSON.stringify(c.expect)}\n  got      ${JSON.stringify(got)}`);
  }
}
console.log(`${fixtures.cases.length - failed}/${fixtures.cases.length} passed`);
process.exit(failed ? 1 : 0);
