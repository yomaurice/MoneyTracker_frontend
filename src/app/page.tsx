'use client';

import { useState, useEffect } from 'react';
import AddTransaction from '../components/AddTransaction';
import Analytics from '../components/Analytics';
import { authFetch } from '../utils/auth_fetch';
import { API_BASE_URL } from '../utils/api_base';
import { logout } from '../utils/logout';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'add' | 'analytics'>('add');
  const [refreshAnalytics, setRefreshAnalytics] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [user, setUser] = useState<{ username: string } | null>(null);

  // ---------------- LOAD USER ----------------
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/me`);
        if (res.ok) {
          const data = await res.json();
          setUser({ username: data.username });
        }
      } catch (err) {
        console.error('Failed to load user', err);
      }
    };

    loadUser();
  }, []);

  // ---------------- HANDLERS ----------------
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

      {/* -------- USER BAR -------- */}
      <div className="flex justify-end items-center gap-4 mb-6">
        {user?.username && (
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Hello,&nbsp;
            <span className="font-semibold">{user.username}</span>
          </span>
        )}

        <button
          onClick={logout}
          className="text-sm px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
        >
          Logout
        </button>
      </div>

      {/* -------- TABS -------- */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-full bg-gray-100 p-1 shadow-sm">
          <button
            onClick={() => {
              setActiveTab('add');
              setSelectedTransaction(null);
            }}
            className={`px-6 py-2 rounded-full text-sm font-medium transition
              ${activeTab === 'add'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-600 hover:bg-white'}`}
          >
            Add Transaction
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition
              ${activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-600 hover:bg-white'}`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* -------- CONTENT -------- */}
      <div className="max-w-4xl mx-auto">
        {activeTab === 'add' && (
          <AddTransaction
            onTransactionAdded={handleTransactionAdded}
            transactionToEdit={selectedTransaction}
          />
        )}

        {activeTab === 'analytics' && (
          <Analytics
            key={refreshAnalytics}
            onEdit={handleEditTransaction}
          />
        )}
      </div>
    </div>
  );
}
