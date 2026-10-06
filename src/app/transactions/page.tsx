'use client';

import TransactionFinder from '@/components/TransactionFinder';

export default function TransactionsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4">
      <h1 className="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
        Transactions
      </h1>
      <TransactionFinder />
    </div>
  );
}
