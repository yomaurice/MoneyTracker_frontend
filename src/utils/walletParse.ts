/**
 * Read a payment notification into amount, currency, merchant and direction.
 *
 * The twin of backend/services/wallet_parse.py, so the /add page can prefill
 * instantly without waiting on a sleeping backend. Both are held to
 * backend/tests/fixtures/wallet_notifications.json -- run
 * `node --experimental-strip-types scripts/check-wallet-parse.ts`.
 * Change one, change both.
 */

export type ParsedNotification = {
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  type: 'expense' | 'income';
};

const BIDI = /[‎‏‪-‮⁦-⁩]/g;

const CURRENCIES: [string, string][] = [
  ['ש"ח', 'ILS'], ['ש״ח', 'ILS'], ['₪', 'ILS'], ['ILS', 'ILS'], ['NIS', 'ILS'],
  ['$', 'USD'], ['USD', 'USD'],
  ['€', 'EUR'], ['EUR', 'EUR'],
  ['£', 'GBP'], ['GBP', 'GBP'],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CUR = CURRENCIES.map(([sign]) => escape(sign)).join('|');
const NUM = String.raw`\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

const AMOUNT_PATTERNS = [
  new RegExp(`(?<cur>${CUR})\\s*(?<num>${NUM})`),
  new RegExp(`(?<num>${NUM})\\s*(?<cur>${CUR})`),
];

const GENERIC_TITLES = [
  'google wallet', 'google pay', 'gpay', 'wallet', 'ארנק google',
  'google ארנק', 'ארנק',
];

// JavaScript's \b is ASCII-only, so word starts are spelled out explicitly.
const MERCHANT_IN_TEXT = new RegExp(
  String.raw`(?:(?:^|\s)at\s+|(?:^|\s)ב-|(?:^|\s)אצל\s+)(?<m>.+?)` +
  String.raw`(?=\s+(?:with|using|עם|באמצעות|בכרטיס)(?:\s|$)|$)`,
);

const REFUND_WORDS = ['החזר', 'זיכוי', 'refund', 'refunded', 'credited'];

function toNumber(text: string): number {
  // The last separator is decimal only when two or fewer digits follow it.
  const decimal = text.match(/[.,](\d{1,2})$/);
  if (decimal) {
    const whole = text.slice(0, decimal.index).replace(/[.,]/g, '');
    return parseFloat(`${whole}.${decimal[1]}`);
  }
  return parseFloat(text.replace(/[.,]/g, ''));
}

const clean = (text: string | null | undefined) =>
  (text || '').replace(BIDI, '').replace(/\s+/g, ' ').trim();

export function parseNotification(
  rawTitle: string | null | undefined,
  rawText: string | null | undefined,
): ParsedNotification {
  const title = clean(rawTitle);
  const text = clean(rawText);

  let amount: number | null = null;
  let currency: string | null = null;
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern) || title.match(pattern);
    if (match?.groups) {
      amount = toNumber(match.groups.num);
      currency = CURRENCIES.find(([sign]) => sign === match.groups!.cur)?.[1] ?? null;
      break;
    }
  }

  let merchant: string | null = null;
  const titleIsGeneric = GENERIC_TITLES.includes(title.toLowerCase());
  if (title && !titleIsGeneric && !AMOUNT_PATTERNS.some(p => p.test(title))) {
    merchant = title;
  } else if (amount !== null) {
    const found = text.match(MERCHANT_IN_TEXT);
    if (found?.groups) merchant = found.groups.m.replace(/^[\s.,]+|[\s.,]+$/g, '');
  }

  const lowered = `${title} ${text}`.toLowerCase();
  const isRefund = REFUND_WORDS.some(word => lowered.includes(word));

  return {
    amount,
    currency,
    merchant: merchant || null,
    type: isRefund ? 'income' : 'expense',
  };
}
