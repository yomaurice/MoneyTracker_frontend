
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation'; // Add this at the top if not already
import { authFetch } from '../utils/auth_fetch'
import { useCurrency } from '../context/CurrencyContext';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

const API_BASE_URL = 'http://localhost:5000/api';

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount || 0);
};

const getCurrentYearMonth = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}`;
};

export default function Analytics({ onEdit }: { onEdit: (id: string) => void }) {


interface AnalyticsResponse {
  summary: {
    [period: string]: {
      income: number;
      expense: number;
    };
  };
  categoryBreakdown: {
    [period: string]: {
      income: { [category: string]: number };
      expense: { [category: string]: number };
    };
  };
  details: {
    [period: string]: {
      id: number;
      type: 'income' | 'expense';
      category: string;
      amount: number;
      description: string | null;
      date: string;
    }[];
  };
}

  const [rawAnalytics, setRawAnalytics] = useState<AnalyticsResponse | null>(null);
  const [viewMode, setViewMode] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [categoryColors, setCategoryColors] = useState(() => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('categoryColors');
        return stored ? JSON.parse(stored) : {};
      }
      return {};
  });
  const { currency } = useCurrency();

function getCategoryColor(category: string) {
  if (categoryColors[category]) {
    return categoryColors[category];
  }

  // Generate a random pastel color
  const hue = Math.floor(Math.random() * 360);
  const backgroundColor = `hsl(${hue}, 100%, 90%)`;
  const color = `hsl(${hue}, 80%, 30%)`;

  const newColor = { backgroundColor, color };

    setCategoryColors((prev: Record<string, { backgroundColor: string; color: string }>) => ({
    ...prev,
    [category]: newColor,
  }));

  return newColor;
}

useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('categoryColors', JSON.stringify(categoryColors));
  }
}, [categoryColors]);


  useEffect(() => {
  fetchAnalytics();
}, [categoryFilter]);

useEffect(() => {
  fetchAnalytics(true); // fetch all for categories on initial mount
}, []);

const [expenseCategories, setExpenseCategories] = useState([]);

useEffect(() => {
  const fetchCategories = async () => {
    const res = await authFetch(`${API_BASE_URL}/categories/expense`);
    if (res.ok) {
      const data = await res.json();
      console.log("Fetched category data:", data);
      setExpenseCategories(data);
    } else {
      console.error("Failed to fetch categories");
    }
  };
  fetchCategories();
}, []);

const fetchAnalytics = async (includeAll = false) => {
  setLoading(true);
  try {
    const params = new URLSearchParams({
      period: 'monthly',
    });

    // Only apply category filter if not doing "all"
    if (!includeAll && categoryFilter !== 'all') {
      params.append('categories', categoryFilter);
    }

    const res = await authFetch(`${API_BASE_URL}/analytics?${params}`);
    if (!res.ok) {
      console.error('Failed to load analytics:', res.statusText);
      setRawAnalytics(null);
    } else {
      const data = await res.json();
      setRawAnalytics(data);
    }
  } catch (e) {
    console.error(e);
    setRawAnalytics(null);
  } finally {
    setLoading(false);
  }
};

  const currentYear = new Date().getFullYear().toString();

  const computeYearlySummary = () => {
    if (!rawAnalytics?.summary) return { income: 0, expense: 0 };
    let totalInc = 0;
    let totalExp = 0;
    Object.entries(rawAnalytics.summary).forEach(([period, vals]) => {
      if (period.startsWith(currentYear + '-')) {
        totalInc += vals.income || 0;
        totalExp += vals.expense || 0;
      }
    });
    return { income: totalInc, expense: totalExp };
  };

  const buildYearlyChartData = () => {
  if (!rawAnalytics?.summary || !rawAnalytics?.categoryBreakdown) return [];

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const arr = [];

      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, '0');
        const key = `${currentYear}-${mm}`;

        type MonthData = {
          monthLabel: string;
          [category: string]: number | string;
        };

        const monthData: MonthData = { monthLabel: monthNames[m - 1] };

        // categoryBreakdown is assumed to be { expense: { categoryName: amount, ... } }
        const breakdown = rawAnalytics.categoryBreakdown[key]?.expense || {};

        // Copy all categories with their expense into monthData
        for (const [category, amount] of Object.entries(breakdown)) {
          monthData[category] = amount;
        }

        arr.push(monthData);
      }
      return arr;
    };

  const buildYearlyExpenseList = () => {
    if (!rawAnalytics?.details) return [];

    interface Transaction {
          id: number;
          type: 'income' | 'expense';
          category: string;
          amount: number;
          description: string | null;
          date: string; // formatted as 'YYYY-MM-DD'
        }
    let allTx: Transaction[] = [];
    Object.entries(rawAnalytics.details).forEach(([periodKey, txArray]) => {
      if (periodKey.startsWith(currentYear + '-')) {
        allTx = allTx.concat(
          txArray.filter(
            (tx) => (categoryFilter === 'all' || tx.category === categoryFilter)
          )
        );
      }
    });
    return allTx.sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  const computeMonthlySummary = () => {
    if (!rawAnalytics?.summary) return { income: 0, expense: 0 };
    const vals = rawAnalytics.summary[selectedMonth] || { income: 0, expense: 0 };
    return { income: vals.income || 0, expense: vals.expense || 0 };
  };

  const buildMonthlyChartData = () => {
    if (!rawAnalytics?.categoryBreakdown) return [];
    const expObj = rawAnalytics.categoryBreakdown[selectedMonth]?.expense || {};
    if (categoryFilter === 'all') {
      return Object.entries(expObj).map(([cat, amt]) => ({ category: cat, expense: amt }));
    } else {
      return [{ category: categoryFilter, expense: expObj[categoryFilter] || 0 }];
    }
  };

  const buildMonthlyExpenseList = () => {
    if (!rawAnalytics?.details) return [];
    const arr = rawAnalytics.details[selectedMonth] || [];
    return arr
      .filter(
        (tx) => (categoryFilter === 'all' || tx.category === categoryFilter)
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  };

//   const expenseCategories = useMemo(() => {
//     if (!rawAnalytics?.categoryBreakdown) return [];
//     const allCategories = new Set();
//     Object.values(rawAnalytics.categoryBreakdown).forEach((entry) => {
//       const expenses = entry.expense || {};
//       Object.keys(expenses).forEach((cat) => allCategories.add(cat));
//     });
//     return Array.from(allCategories).sort();
//   }, [rawAnalytics]);

  if (loading) return <div className="bg-white p-6 text-center">Loading…</div>;
  if (!rawAnalytics) return <div className="bg-white p-6 text-center">No data available.</div>;

  const isYearly = viewMode === 'yearly';
  const { income, expense } = isYearly ? computeYearlySummary() : computeMonthlySummary();
  const net = income - expense;
  const chartData = isYearly ? buildYearlyChartData() : buildMonthlyChartData();
  const expenseList = isYearly ? buildYearlyExpenseList() : buildMonthlyExpenseList();


    const handleEdit = (tx: any) => {
       onEdit(tx);
    };


    const handleDelete = async (id: any) => {
      if (!window.confirm('Are you sure you want to delete this transaction?')) return;

      try {
        const res = await authFetch(`${API_BASE_URL}/transactions/${id}`, {
          method: 'DELETE',
        });

        if (!res.ok) throw new Error('Failed to delete');

        // Refetch data
        fetchAnalytics();
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete transaction.');
      }
    };


  return (
    <div className="space-y-6 px-4 md:px-6">
      {/* ─── HEADER & FILTERS ─────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Financial Analytics</h2>

        <div className="flex flex-wrap gap-6 items-end">
          {/* View Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              View
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* If Monthly, show Month picker */}
          {!isYearly && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Month
              </label>
              <input
                type="month"
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          )}

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categories
            </label>
          <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border p-1 rounded"
            >
              <option value="all">All Categories</option>
              {expenseCategories.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat || "(Unnamed Category)"}  {/* fallback for empty names */}
                </option>
              ))}
</select>



          </div>
        </div>
      </div>

      {/* ─── MAIN GRID: Chart + Summary + List ─────────────────────────────┐ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/** ── LEFT COLUMN (List of Expenses) ─────────────────────────── */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              {isYearly
                ? `Latest Expenses (${currentYear})`
                : (() => {
                    const [year, month, day] = selectedMonth
                      .split('-')
                      .map((s, i) => (i === 1 ? parseInt(s) - 1 : parseInt(s)));
                    return `Expenses in ${new Date(year, month, day).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                    })}`;
                  })()}
            </h3>
            <div className="overflow-y-auto flex-1">
              {expenseList.length === 0 && (
                <div className="text-sm text-gray-500">No expenses to show.</div>
              )}
              {expenseList.map((tx) => (
  <div key={tx.id} className="border-b border-gray-200 py-2 last:border-none">
    <div className="flex justify-between items-center text-sm">
        {(() => {
          const color = getCategoryColor(tx.category);
          return (
            <span
              style={{
                backgroundColor: color.backgroundColor,
                color: color.color,
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {tx.category}
            </span>
          );
        })()}
      <span className="text-red-600">{formatCurrency(tx.amount, currency)}</span>
    </div>

    <div className="flex justify-between items-center text-xs text-gray-500 mt-0.5">
      <span>
        {new Date(tx.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
      <span className="italic">{tx.description}</span>
    </div>

    {/* 👇 Buttons Row */}
    <div className="mt-2 flex gap-2 text-xs">
      <button
        onClick={() => handleEdit(tx)}
        className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
      >
        Edit
      </button>
      <button
        onClick={() => handleDelete(tx.id)}
        className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
      >
        Delete
      </button>
    </div>
  </div>
))}

            </div>
          </div>
        </div>

        {/** ── MIDDLE (Bar Chart) and RIGHT (Summary Box) ─────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-6 order-1 lg:order-2">
          {/** ── SUMMARY BOX at top-right ─────────────────────────── */}
          <div className="flex justify-end">
            <div className="bg-white rounded-lg shadow-md p-4 w-full md:w-1/2 lg:w-4/5">
              <h3 className="text-lg font-medium mb-3 text-gray-800">
                {isYearly ? `Year ${currentYear} Summary` : 'This Month Summary'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Income */}
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">Income</div>
                  <div className="text-2xl font-bold text-green-700">
                    {formatCurrency(income, currency)}
                  </div>
                </div>
                {/* Expenses */}
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-sm text-red-600 font-medium">Expenses</div>
                  <div className="text-2xl font-bold text-red-700">
                    {formatCurrency(expense, currency)}
                  </div>
                </div>
                {/* Net */}
                <div
                  className={`p-3 rounded-lg ${
                    net >= 0 ? 'bg-blue-50' : 'bg-orange-50'
                  }`}
                >
                  <div
                    className={`text-sm font-medium ${
                      net >= 0 ? 'text-blue-600' : 'text-orange-600'
                    }`}
                  >
                    Net
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      net >= 0 ? 'text-blue-700' : 'text-orange-700'
                    }`}
                  >
                    {formatCurrency(net, currency)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/** ── BAR CHART ───────────────────────────────────────────── */}
            <div className="bg-white rounded-lg shadow-md p-4 flex-1">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                  {isYearly
                    ? 'Expenses Per Month'
                    : `Expenses by Category (${(() => {
                        const [year, month, day] = selectedMonth
                          .split('-')
                          .map((s, i) => (i === 1 ? parseInt(s) - 1 : parseInt(s)));
                        return new Date(year, month, day).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                        });
                      })()})`}
                </h3>

              {chartData.length === 0 ? (
                <div className="text-center text-gray-500">
                  No data to draw chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={isYearly ? 'monthLabel' : 'category'}
                      angle={isYearly ? 0 : -30}
                      textAnchor={isYearly ? 'middle' : 'end'}
                      height={isYearly ? undefined : 70}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value, currency)} />

                    {isYearly ? (
                      expenseCategories?.map((category) => {
                        const color = getCategoryColor(category);
                        return (
                          <Bar
                            key={category}
                            dataKey={category}
                            stackId="a"
                            name={category}
                            fill={color?.backgroundColor || '#ccc'}
                          />
                        );
                      })
                    ) : (
                      <Bar
                        dataKey="expense"
                        name="Expense"
                        shape={(props) => {
                          const { x, y, width, height, payload } = props;
                          const color = getCategoryColor(payload.category)?.backgroundColor || '#ccc';
                          return (
                            <rect
                              x={x}
                              y={y}
                              width={width}
                              height={height}
                              fill={color}
                              rx={6}
                            />
                          );
                        }}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>


        </div>
      </div>
    </div>
  );
}
