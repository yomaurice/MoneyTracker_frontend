'use client';

import { useState } from 'react';
import AddTransaction from '../components/AddTransaction';
import Analytics from '../components/Analytics';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'add' | 'analytics'>('add');
  const [refreshAnalytics, setRefreshAnalytics] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const handleTransactionAdded = () => {
    setRefreshAnalytics((prev) => prev + 1);
    setSelectedTransaction(null);
  };

  const handleEditTransaction = (tx: any) => {
    setSelectedTransaction(tx);
    setActiveTab('add');
  };

  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* Tabs */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-full bg-gray-100 p-1 shadow-sm">
          <button
            onClick={() => {
              setActiveTab('add');
              setSelectedTransaction(null);
            }}
            className={`px-6 py-2 rounded-full text-sm font-medium transition
              ${
                activeTab === 'add'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-white'
              }`}
          >
            Add Transaction
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition
              ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-white'
              }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {activeTab === 'add' && (
          <AddTransaction
            onTransactionAdded={handleTransactionAdded}
            transactionToEdit={selectedTransaction}
          />
        )}

        {activeTab === 'analytics' && (
          <Analytics key={refreshAnalytics} onEdit={handleEditTransaction} />
        )}
      </div>
    </div>
  );
}
