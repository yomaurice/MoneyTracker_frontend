'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AddTransaction from '../components/AddTransaction'
import Analytics from '../components/Analytics'
import { logout } from '../utils/logout';
import { useCurrency } from '../context/CurrencyContext';

export default function Home() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('add')
  const [refreshAnalytics, setRefreshAnalytics] = useState(0)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const { currency, setCurrency } = useCurrency();

  useEffect(() => {
    sessionStorage.removeItem('authSettling');
  }, []);


  useEffect(() => {
  const checkAuth = async () => {
    const res = await authFetch(`${API_BASE_URL}/api/me`, {}, true);
    if (!res.ok) {
      router.push('/login');
    }
  };

  checkAuth();
}, []);


  const handleTransactionAdded = () => {
    setRefreshAnalytics((prev) => prev + 1)
    setSelectedTransaction(null)
  }

  const handleEditTransaction = (tx: any) => {
    setSelectedTransaction(tx)
    setActiveTab('add')
  }


  const logout = async () => {
  await fetch(`${API_BASE_URL}/api/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  router.push('/login');
};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Money Tracker
        </h1>
        <div className="flex justify-end mb-4">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex right p-1 border rounded"
                >
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                  <option value="GBP">GBP £</option>
                  <option value="ILS">ILS ₪</option>
                </select>
                <button
                    onClick={logout}
                    className="flex right bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                >Logout</button>
        </div>
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-md p-1">
            <button
              onClick={() => {
                setActiveTab('add')
                setSelectedTransaction(null)
              }}
              className={`px-6 py-3 rounded-md font-medium transition-colors ${
                activeTab === 'add'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              Add Transaction
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 rounded-md font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              Analytics
            </button>
          </div>
        </div>

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
    </div>
  )
}
