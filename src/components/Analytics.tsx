'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth_fetch';
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

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const monthOptions = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

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

export default function Analytics({ onEdit }: { onEdit: (tx: any) => void }) {
  const [rawAnalytics, setRawAnalytics] = useState<AnalyticsResponse | null>(
    null
  );
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());

  // NEW: year + month for YEARLY mode
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedYearlyMonth, setSelectedYearlyMonth] = useState<'all' | string>(
    'all'
  );

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);

  const [categoryColors, setCategoryColors] = useState<
    Record<string, { backgroundColor: string; color: string }>
  >(() => {
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

    setCategoryColors((prev) => ({
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

  // Fetch analytics
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

      const res = await authFetch(
        `${API_BASE_URL}/api/analytics?${params.toString()}`
      );
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

  // Refetch when category filter changes
  useEffect(() => {
    fetchAnalytics();
  }, [categoryFilter]);

  // Initial fetch: full data for categories
  useEffect(() => {
    fetchAnalytics(true);
  }, []);

  // Fetch expense categories
  useEffect(() => {
    const fetchCategories = async () => {
      const res = await authFetch(`${API_BASE_URL}/api/categories/expense`);
      if (res.ok) {
        const data = await res.json();
        setExpenseCategories(data);
      } else {
        console.error('Failed to fetch categories');
      }
    };
    fetchCategories();
  }, []);

  // ─────────────────────────────────────────────
  // YEARLY helpers (filtered by selectedYear + selectedYearlyMonth)
  // ─────────────────────────────────────────────
  const computeYearlySummary = () => {
    if (!rawAnalytics?.summary) return { income: 0, expense: 0 };

    const y = String(selectedYear);
    let totalInc = 0;
    let totalExp = 0;

    Object.entries(rawAnalytics.summary).forEach(([period, vals]) => {
      if (!period.startsWith(`${y}-`)) return;

      if (selectedYearlyMonth !== 'all' && !period.endsWith(selectedYearlyMonth))
        return;

      totalInc += vals.income || 0;
      totalExp += vals.expense || 0;
    });

    return { income: totalInc, expense: totalExp };
  };

  const buildYearlyChartData = () => {
    if (!rawAnalytics?.summary || !rawAnalytics?.categoryBreakdown) return [];

    const y = String(selectedYear);
    const arr: any[] = [];

    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');

      if (selectedYearlyMonth !== 'all' && selectedYearlyMonth !== mm) continue;

      const key = `${y}-${mm}`;
      const monthData: any = {
        monthLabel: monthOptions[m - 1].label,
      };

      const breakdown = rawAnalytics.categoryBreakdown[key]?.expense || {};
      Object.entries(breakdown).forEach(([cat, amount]) => {
        monthData[cat] = amount;
      });

      // If there is at least one expense, or you want to show empty months too:
      arr.push(monthData);
    }

    return arr;
  };

  const buildYearlyExpenseList = () => {
    if (!rawAnalytics?.details) return [];

    const y = String(selectedYear);
    let list: any[] = [];

    Object.entries(rawAnalytics.details).forEach(([periodKey, txArray]) => {
      if (!periodKey.startsWith(`${y}-`)) return;

      if (
        selectedYearlyMonth !== 'all' &&
        !periodKey.endsWith(selectedYearlyMonth)
      )
        return;

      txArray.forEach((tx) => {
        if (categoryFilter === 'all' || tx.category === categoryFilter) {
          list.push(tx);
        }
      });
    });

    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  // ─────────────────────────────────────────────
  // MONTHLY helpers (selectedMonth = "YYYY-MM")
  // ─────────────────────────────────────────────
  const computeMonthlySummary = () => {
    if (!rawAnalytics?.summary) return { income: 0, expense: 0 };
    const vals = rawAnalytics.summary[selectedMonth] || {
      income: 0,
      expense: 0,
    };
    return { income: vals.income || 0, expense: vals.expense || 0 };
  };

  const buildMonthlyChartData = () => {
    if (!rawAnalytics?.categoryBreakdown) return [];
    const expObj =
      rawAnalytics.categoryBreakdown[selectedMonth]?.expense || {};
    if (categoryFilter === 'all') {
      return Object.entries(expObj).map(([cat, amt]) => ({
        category: cat,
        expense: amt,
      }));
    } else {
      return [
        {
          category: categoryFilter,
          expense: expObj[categoryFilter] || 0,
        },
      ];
    }
  };

  const buildMonthlyExpenseList = () => {
    if (!rawAnalytics?.details) return [];
    const arr = rawAnalytics.details[selectedMonth] || [];
    return arr
      .filter(
        (tx) => categoryFilter === 'all' || tx.category === categoryFilter
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  // ─────────────────────────────────────────────
  // Early loading / error states
  // ─────────────────────────────────────────────
  if (loading)
    return <div className="bg-white p-6 text-center">Loading…</div>;
  if (!rawAnalytics)
    return (
      <div className="bg-white p-6 text-center">No data available.</div>
    );

  const isYearly = viewMode === 'yearly';
  const { income, expense } = isYearly
    ? computeYearlySummary()
    : computeMonthlySummary();
  const net = income - expense;
  const chartData = isYearly
    ? buildYearlyChartData()
    : buildMonthlyChartData();
  const expenseList = isYearly
    ? buildYearlyExpenseList()
    : buildMonthlyExpenseList();

  const handleEdit = (tx: any) => {
    onEdit(tx);
  };

  const handleDelete = async (id: any) => {
    if (!window.confirm('Are you sure you want to delete this transaction?'))
      return;

    try {
      const res = await authFetch(`${API_BASE_URL}/api/transactions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      // Refetch data (respecting current filters)
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
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">
          Financial Analytics
        </h2>

        <div className="flex flex-wrap gap-6 items-end">
          {/* View Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              View
            </label>
            <select
              value={viewMode}
              onChange={(e) =>
                setViewMode(e.target.value as 'monthly' | 'yearly')
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Month picker when Monthly */}
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

          {/* Year & Month dropdowns when Yearly */}
          {isYearly && (
            <>
              {/* YEAR DROPDOWN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500"
                >
                  {Array.from({ length: 6 }).map((_, i) => {
                    const y = new Date().getFullYear() - i;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* MONTH DROPDOWN (OPTIONAL WITH "ALL") */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Month
                </label>
                <select
                  value={selectedYearlyMonth}
                  onChange={(e) =>
                    setSelectedYearlyMonth(e.target.value as 'all' | string)
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500"
                >
                  <option value="all">All months</option>
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categories
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border px-3 py-2 rounded"
            >
              <option value="all">All Categories</option>
              {expenseCategories.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat || '(Unnamed Category)'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── MAIN GRID: Chart + Summary + List ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN (List of Expenses) ─────────────────────────── */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              {isYearly
                ? `Latest Expenses (${selectedYear}${
                    selectedYearlyMonth !== 'all'
                      ? ` - ${
                          monthOptions.find(
                            (m) => m.value === selectedYearlyMonth
                          )?.label ?? ''
                        }`
                      : ''
                  })`
                : (() => {
                    const [year, month] = selectedMonth
                      .split('-')
                      .map((s, i) =>
                        i === 1 ? parseInt(s) - 1 : parseInt(s, 10)
                      );
                    return `Expenses in ${new Date(
                      year,
                      month,
                      1
                    ).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                    })}`;
                  })()}
            </h3>
            <div className="overflow-y-auto flex-1">
              {expenseList.length === 0 && (
                <div className="text-sm text-gray-500">
                  No expenses to show.
                </div>
              )}
              {expenseList.map((tx: any) => (
                <div
                  key={tx.id}
                  className="border-b border-gray-200 py-2 last:border-none"
                >
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
                    <span className="text-red-600">
                      {formatCurrency(tx.amount, currency)}
                    </span>
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

                  {/* Buttons Row */}
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

        {/* ── MIDDLE (Bar Chart) and RIGHT (Summary Box) ─────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-6 order-1 lg:order-2">
          {/* SUMMARY BOX */}
          <div className="flex justify-end">
            <div className="bg-white rounded-lg shadow-md p-4 w-full md:w-1/2 lg:w-4/5">
              <h3 className="text-lg font-medium mb-3 text-gray-800">
                {isYearly
                  ? `Year ${selectedYear}${
                      selectedYearlyMonth !== 'all'
                        ? ` - ${
                            monthOptions.find(
                              (m) => m.value === selectedYearlyMonth
                            )?.label ?? ''
                          }`
                        : ''
                    } Summary`
                  : 'This Month Summary'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Income */}
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">
                    Income
                  </div>
                  <div className="text-2xl font-bold text-green-700">
                    {formatCurrency(income, currency)}
                  </div>
                </div>
                {/* Expenses */}
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-sm text-red-600 font-medium">
                    Expenses
                  </div>
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

          {/* BAR CHART */}
          <div className="bg-white rounded-lg shadow-md p-4 flex-1">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              {isYearly
                ? 'Expenses Per Month'
                : `Expenses by Category (${(() => {
                    const [year, month] = selectedMonth
                      .split('-')
                      .map((s, i) =>
                        i === 1 ? parseInt(s) - 1 : parseInt(s, 10)
                      );
                    return new Date(year, month, 1).toLocaleDateString(
                      'en-US',
                      {
                        year: 'numeric',
                        month: 'long',
                      }
                    );
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
                  <Tooltip
                    formatter={(value) =>
                      formatCurrency(Number(value ?? 0), currency)
                    }
                  />

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
                      shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const color = payload?.category
                          ? getCategoryColor(payload.category)
                              ?.backgroundColor || '#ccc'
                          : '#ccc';
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
