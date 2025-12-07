'use client';

import { authFetch } from '../utils/auth_fetch'
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function AddTransaction({ onTransactionAdded, transactionToEdit }: { onTransactionAdded: any, transactionToEdit?: any }) {

  const router = useRouter();
  const searchParams = useSearchParams();

  const idFromQuery = searchParams.get('id');
  const id = transactionToEdit?.id ?? idFromQuery;

  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    type: 'expense',
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [message, setMessage] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceMonths, setRecurrenceMonths] = useState(1);

  const initialized = useRef(false);
    useEffect(() => {
        sessionStorage.removeItem('authSettling');
        }, []);
  // ------------------------
  // 1️⃣ Load Categories when type changes
  // ------------------------
  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/categories/${formData.type}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        setCategories(data);
      }
    });
  }, [formData.type]);

  // ------------------------
  // 2️⃣ Load existing transaction for editing
  // ------------------------
  useEffect(() => {
    if (!id) return;

    authFetch(`${API_BASE_URL}/api/transactions/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(data => {
        setFormData({
          type: data.type,
          category: data.category,
          amount: data.amount.toString(),
          description: data.description,
          date: data.date,
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load transaction:', err);
        setMessage('Failed to load transaction');
        setLoading(false);
      });
  }, [id]);

  // ------------------------
  // 3️⃣ If editing from parent (Analytics → Edit)
  // ------------------------
  useEffect(() => {
    if (transactionToEdit) {
      setFormData({
        type: transactionToEdit.type,
        category: transactionToEdit.category,
        amount: transactionToEdit.amount.toString(),
        description: transactionToEdit.description,
        date: transactionToEdit.date,
      });
    }
  }, [transactionToEdit]);

  // ------------------------
  // 4️⃣ Reset form ONLY once when creating a new transaction
  //    ❗ This was the cause of your disappearing categories!
  // ------------------------
  useEffect(() => {
    if (!initialized.current && !transactionToEdit && !idFromQuery) {
      initialized.current = true;

      setFormData({
        type: 'expense',
        category: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });

      setIsRecurring(false);
      setRecurrenceMonths(1);
    }
  }, []);

  // ------------------------
  // Handlers
  // ------------------------
  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    const url = id ? `${API_BASE_URL}/api/transactions/${id}` : `${API_BASE_URL}/api/transactions`;
    const method = id ? 'PUT' : 'POST';

    const payload: any = {
      ...formData,
      amount: parseFloat(formData.amount),
    };

    if (isRecurring && recurrenceMonths > 1) {
      payload.is_recurring = true;
      payload.recurrence_months = recurrenceMonths;
    }

    try {
      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setIsSuccess(true);
        setMessage(id ? 'Transaction updated!' : 'Transaction added!');
        onTransactionAdded?.();

        // Reset for new transaction
        setFormData({
          type: 'expense',
          category: '',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
        });

        setIsRecurring(false);
        setRecurrenceMonths(1);

        setTimeout(() => setMessage(''), 1200);
      } else {
        setIsSuccess(false);
        const data = await response.json();
        setMessage(data.error || 'Failed to save transaction');
      }
    } catch (err) {
      console.error(err);
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCategoryEditor = () => {
    setShowCategoryEditor(prev => !prev);
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    const res = await authFetch(`${API_BASE_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: formData.type, name: newCategory.trim() }),
    });

    if (res.ok) {
      setIsSuccess(true);
      const updatedCategories = await res.json();
      setCategories(updatedCategories);
      setNewCategory('');
    }
  };

  const handleDeleteCategory = async (name: string) => {
    const res = await authFetch(`${API_BASE_URL}/api/category/delete/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      setIsSuccess(true);
      setCategories(prev => prev.filter(c => c !== name));

      if (formData.category === name) {
        setFormData(prev => ({ ...prev, category: '' }));
      }
    }
  };

  // ------------------------
  // Rendering
  // ------------------------
  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">
        {id ? 'Edit Transaction' : 'Add New Transaction'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type *</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="income"
                checked={formData.type === 'income'}
                onChange={handleInputChange}
                className="mr-2"
              />
              <span className="text-green-600 font-medium">Income</span>
            </label>

            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="expense"
                checked={formData.type === 'expense'}
                onChange={handleInputChange}
                className="mr-2"
              />
              <span className="text-red-600 font-medium">Expense</span>
            </label>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>

          <div className="flex items-center gap-4">
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">Select a category</option>

              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleToggleCategoryEditor}
              className="text-sm text-blue-600 hover:underline"
            >
              {showCategoryEditor ? 'Close' : 'Edit Categories'}
            </button>
          </div>

          {showCategoryEditor && (
            <div className="mt-4 border border-gray-200 p-4 rounded-md bg-gray-50">
              <h4 className="text-sm font-semibold mb-2">Manage Categories</h4>

              <ul className="space-y-1 mb-3">
                {categories.map(cat => (
                  <li key={cat} className="flex justify-between items-center">
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                />

                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
          <input
            type="number"
            name="amount"
            value={formData.amount}
            onChange={handleInputChange}
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            placeholder="Optional description..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Recurring */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="mr-2"
            />
            Recurring Monthly
          </label>

          {isRecurring && (
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Months</label>
              <input
                type="number"
                min="1"
                value={recurrenceMonths}
                onChange={(e) => setRecurrenceMonths(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 px-4 rounded-md font-medium text-white transition-colors ${
            loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {loading ? 'Saving...' : id ? 'Update Transaction' : 'Add Transaction'}
        </button>

        {message && (
          <div
            className={`p-3 rounded-md text-center ${
              isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message}
          </div>
        )}

      </form>
    </div>
  );
}
