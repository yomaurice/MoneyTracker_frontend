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
  ReferenceLine,
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

const formatCurrency = (amount: number, currency: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    amount || 0
  );

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
  const [viewMode, setViewMode] = useState<
    'monthly' | 'yearly' | 'monthAcrossYears'
  >('monthly');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
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
    if (categoryColors[category]) return categoryColors[category];
    const hue = Math.floor(Math.random() * 360);
    const backgroundColor = `hsl(${hue}, 100%, 90%)`;
    const color = `hsl(${hue}, 80%, 30%)`;
    const newColor = { backgroundColor, color };
    setCategoryColors((prev) => ({ ...prev, [category]: newColor }));
    return newColor;
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('categoryColors', JSON.stringify(categoryColors));
    }
  }, [categoryColors]);

  // ---- Analytics fetch (monthly data for all periods) ----
  const fetchAnalytics = async (includeAll = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period: 'monthly' });
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

  useEffect(() => {
    fetchAnalytics();
  }, [categoryFilter]);

  useEffect(() => {
    fetchAnalytics(true);
  }, []);

  // ---- Categories ----
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

  // ---- Load years from /years endpoint (if available) ----
  useEffect(() => {
    const loadYearsFromApi = async () => {
      try {
        const r = await authFetch(`${API_BASE_URL}/api/analytics/years`);
        if (!r.ok) return;
        const d = await r.json();
        let yearsRaw = d.years ?? d;
        if (!Array.isArray(yearsRaw)) return;
        const years = yearsRaw
          .map((y: any) => parseInt(String(y), 10))
          .filter((y) => !Number.isNaN(y))
          .sort((a, b) => a - b);
        if (years.length) {
          setAvailableYears(years);
        }
      } catch (err) {
        console.error('Failed to load years from /years endpoint', err);
      }
    };
    loadYearsFromApi();
  }, []);

  // ---- Fallback: derive years from summary keys if API empty ----
  useEffect(() => {
    if (!rawAnalytics?.summary) return;
    if (availableYears.length) return;
    const years = Array.from(
      new Set(
        Object.keys(rawAnalytics.summary)
          .map((key) => parseInt(key.split('-')[0], 10))
          .filter((y) => !Number.isNaN(y))
      )
    ).sort((a, b) => a - b);
    if (years.length) {
      setAvailableYears(years);
    }
  }, [rawAnalytics, availableYears.length]);

  // ---- Ensure selectedYear is one of the available years ----
  useEffect(() => {
    if (!availableYears.length) return;
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, selectedYear]);

  // ---- When entering "monthAcrossYears", make sure month is not 'all' ----
  useEffect(() => {
    if (viewMode === 'monthAcrossYears' && selectedYearlyMonth === 'all') {
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
      setSelectedYearlyMonth(currentMonth);
    }
  }, [viewMode, selectedYearlyMonth]);

  const isYearly = viewMode === 'yearly';
  const isMonthAcrossYears = viewMode === 'monthAcrossYears';

  // Helper: compute average value for a chart
  const computeAverageValue = (data: any[], valueKeys: string[]): number => {
    if (!data.length || !valueKeys.length) return 0;
    let total = 0;
    let count = 0;

    data.forEach((row) => {
      let rowSum = 0;
      valueKeys.forEach((k) => {
        if (typeof row[k] === 'number') {
          rowSum += row[k];
        }
      });
      // Only count rows that actually have some value
      if (rowSum > 0) {
        total += rowSum;
        count += 1;
      }
    });

    return count ? total / count : 0;
  };

  // ---- YEARLY (one year, up to 12 months) ----
  const computeYearlySummary = () => {
    if (!rawAnalytics?.summary) return { income: 0, expense: 0 };
    const y = String(selectedYear);
    let totalInc = 0;
    let totalExp = 0;
    Object.entries(rawAnalytics.summary).forEach(([period, vals]) => {
      if (!period.startsWith(`${y}-`)) return;
      const [, monthStr] = period.split('-');
      if (
        selectedYearlyMonth !== 'all' &&
        monthStr !== selectedYearlyMonth
      )
        return;
      totalInc += vals.income || 0;
      totalExp += vals.expense || 0;
    });
    return { income: totalInc, expense: totalExp };
  };

  const buildYearlyExpenseChartData = () => {
    if (!rawAnalytics?.categoryBreakdown) return [];
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
      arr.push(monthData);
    }
    return arr;
  };

  const buildYearlyIncomeChartData = () => {
    if (!rawAnalytics?.summary) return [];
    const y = String(selectedYear);
    const arr: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      if (selectedYearlyMonth !== 'all' && selectedYearlyMonth !== mm) continue;
      const key = `${y}-${mm}`;
      const vals = rawAnalytics.summary[key] || { income: 0, expense: 0 };
      arr.push({
        monthLabel: monthOptions[m - 1].label,
        income: vals.income || 0,
      });
    }
    return arr;
  };

  const buildYearlyExpenseList = () => {
    if (!rawAnalytics?.details) return [];
    const y = String(selectedYear);
    let list: any[] = [];
    Object.entries(rawAnalytics.details).forEach(([periodKey, txArray]) => {
      if (!periodKey.startsWith(`${y}-`)) return;
      const [, monthStr] = periodKey.split('-');
      if (
        selectedYearlyMonth !== 'all' &&
        monthStr !== selectedYearlyMonth
      )
        return;
      txArray.forEach((tx) => {
        if (tx.type === 'expense') {
          if (categoryFilter === 'all' || tx.category === categoryFilter) {
            list.push(tx);
          }
        }
      });
    });
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  // ---- MONTH ACROSS YEARS (same month, all years) ----
  const computeMonthAcrossYearsSummary = () => {
    if (!rawAnalytics?.summary) return { income: 0, expense: 0 };
    let totalInc = 0;
    let totalExp = 0;
    Object.entries(rawAnalytics.summary).forEach(([period, vals]) => {
      const [, monthStr] = period.split('-');
      if (monthStr !== selectedYearlyMonth) return;
      totalInc += vals.income || 0;
      totalExp += vals.expense || 0;
    });
    return { income: totalInc, expense: totalExp };
  };

  const buildMonthAcrossYearsExpenseChartData = () => {
    if (!rawAnalytics?.categoryBreakdown) return [];
    const arr: any[] = [];
    availableYears.forEach((year) => {
      const key = `${year}-${selectedYearlyMonth}`;
      const row: any = { yearLabel: String(year) };
      const breakdown = rawAnalytics.categoryBreakdown[key]?.expense || {};
      Object.entries(breakdown).forEach(([cat, amount]) => {
        row[cat] = amount;
      });
      arr.push(row);
    });
    return arr;
  };

  const buildMonthAcrossYearsIncomeChartData = () => {
    if (!rawAnalytics?.summary) return [];
    const arr: any[] = [];
    availableYears.forEach((year) => {
      const key = `${year}-${selectedYearlyMonth}`;
      const vals = rawAnalytics.summary[key] || { income: 0, expense: 0 };
      arr.push({
        yearLabel: String(year),
        income: vals.income || 0,
      });
    });
    return arr;
  };

  const buildMonthAcrossYearsExpenseList = () => {
    if (!rawAnalytics?.details) return [];
    let list: any[] = [];
    Object.entries(rawAnalytics.details).forEach(([periodKey, txArray]) => {
      const [, monthStr] = periodKey.split('-');
      if (monthStr !== selectedYearlyMonth) return;
      txArray.forEach((tx) => {
        if (tx.type === 'expense') {
          if (categoryFilter === 'all' || tx.category === categoryFilter) {
            list.push(tx);
          }
        }
      });
    });
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  // ---- MONTHLY (single month) ----
  const computeMonthlySummary = () => {
    if (!rawAnalytics?.summary) return { income: 0, expense: 0 };
    const vals = rawAnalytics.summary[selectedMonth] || {
      income: 0,
      expense: 0,
    };
    return { income: vals.income || 0, expense: vals.expense || 0 };
  };

  const buildMonthlyExpenseChartData = () => {
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

  const buildMonthlyIncomeChartData = () => {
    if (!rawAnalytics?.categoryBreakdown) return [];
    const incObj =
      rawAnalytics.categoryBreakdown[selectedMonth]?.income || {};
    return Object.entries(incObj).map(([cat, amt]) => ({
      category: cat,
      income: amt,
    }));
  };

  const buildMonthlyExpenseList = () => {
    if (!rawAnalytics?.details) return [];
    const arr = rawAnalytics.details[selectedMonth] || [];
    return arr
      .filter(
        (tx) =>
          tx.type === 'expense' &&
          (categoryFilter === 'all' || tx.category === categoryFilter)
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  // ---- loading / empty ----
  if (loading)
    return <div className="bg-white p-6 text-center">Loading…</div>;
  if (!rawAnalytics)
    return (
      <div className="bg-white p-6 text-center">No data available.</div>
    );

  // ---- pick correct summary / chart / list based on view ----
  let income = 0;
  let expense = 0;
  let expenseChartData: any[] = [];
  let incomeChartData: any[] = [];
  let expenseList: any[] = [];

  if (isYearly) {
    ({ income, expense } = computeYearlySummary());
    expenseChartData = buildYearlyExpenseChartData();
    incomeChartData = buildYearlyIncomeChartData();
    expenseList = buildYearlyExpenseList();
  } else if (isMonthAcrossYears) {
    ({ income, expense } = computeMonthAcrossYearsSummary());
    expenseChartData = buildMonthAcrossYearsExpenseChartData();
    incomeChartData = buildMonthAcrossYearsIncomeChartData();
    expenseList = buildMonthAcrossYearsExpenseList();
  } else {
    ({ income, expense } = computeMonthlySummary());
    expenseChartData = buildMonthlyExpenseChartData();
    incomeChartData = buildMonthlyIncomeChartData();
    expenseList = buildMonthlyExpenseList();
  }

  // Averages for charts
  const expenseValueKeys =
    isYearly || isMonthAcrossYears ? expenseCategories : ['expense'];
  const incomeValueKeys = ['income'];

  const avgExpense = computeAverageValue(expenseChartData, expenseValueKeys);
  const avgIncome = computeAverageValue(incomeChartData, incomeValueKeys);

  const net = income - expense;

  const handleEdit = (tx: any) => onEdit(tx);

  const handleDelete = async (id: any) => {
    if (!window.confirm('Are you sure you want to delete this transaction?'))
      return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/transactions/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      fetchAnalytics();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete transaction.');
    }
  };

  const currentMonthLabel = (() => {
    const [year, monthIndex] = selectedMonth
      .split('-')
      .map((s, i) => (i === 1 ? parseInt(s, 10) - 1 : parseInt(s, 10)));
    return new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  })();

  const selectedMonthLabel =
    monthOptions.find((m) => m.value === selectedYearlyMonth)?.label ?? '';

  // Summary titles
  const summaryTitle = isYearly
    ? `Year ${selectedYear}${
        selectedYearlyMonth !== 'all'
          ? ` - ${selectedMonthLabel}`
          : ''
      } Summary`
    : isMonthAcrossYears
    ? `${selectedMonthLabel} – all years summary`
    : 'This Month Summary';

  const summarySubtitle = isYearly
    ? selectedYearlyMonth === 'all'
      ? 'Total income, expenses and net for all months in the selected year.'
      : `Totals for ${selectedMonthLabel} ${selectedYear}.`
    : isMonthAcrossYears
    ? `Totals for all years in ${selectedMonthLabel}.`
    : `Totals for ${currentMonthLabel}.`;

  const expenseChartTitle = isYearly
    ? 'Expenses per month (stacked by category)'
    : isMonthAcrossYears
    ? `Expenses in ${selectedMonthLabel} (stacked by category, all years)`
    : `Expenses by Category (${currentMonthLabel})`;

  const incomeChartTitle = isYearly
    ? 'Income per month'
    : isMonthAcrossYears
    ? `Income in ${selectedMonthLabel} (all years)`
    : `Income by Category (${currentMonthLabel})`;

  const avgExpenseLabel =
    avgExpense > 0 ? `Avg: ${formatCurrency(avgExpense, currency)}` : '';
  const avgIncomeLabel =
    avgIncome > 0 ? `Avg: ${formatCurrency(avgIncome, currency)}` : '';

  return (
    <div className="space-y-6 px-4 md:px-6">
      {/* Header + filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">
          Financial Analytics
        </h2>

        <div className="flex flex-wrap gap-6 items-end">
          {/* View mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              View
            </label>
            <select
              value={viewMode}
              onChange={(e) =>
                setViewMode(
                  e.target.value as
                    | 'monthly'
                    | 'yearly'
                    | 'monthAcrossYears'
                )
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly (12 months)</option>
              <option value="monthAcrossYears">
                Same month across years
              </option>
            </select>
          </div>

          {/* Month picker (monthly view) */}
          {!isYearly && !isMonthAcrossYears && (
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

          {/* Yearly: year + month filter */}
          {isYearly && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Month (optional)
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

          {/* Month across years: only month selector */}
          {isMonthAcrossYears && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Month
              </label>
              <select
                value={selectedYearlyMonth}
                onChange={(e) =>
                  setSelectedYearlyMonth(e.target.value as string)
                }
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category filter (expenses only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categories (expenses)
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

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT – list of expenses */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              {isYearly
                ? `Latest Expenses (${selectedYear}${
                    selectedYearlyMonth !== 'all'
                      ? ` - ${selectedMonthLabel}`
                      : ''
                  })`
                : isMonthAcrossYears
                ? `Latest Expenses (${selectedMonthLabel} – all years)`
                : `Expenses in ${currentMonthLabel}`}
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

        {/* RIGHT – Summary + charts */}
        <div className="lg:col-span-2 flex flex-col gap-6 order-1 lg:order-2">
          {/* Summary */}
          <div className="flex justify-end">
            <div className="bg-white rounded-lg shadow-md p-4 w-full max-w-full lg:w-full xl:w-11/12 mx-auto">
              <h3 className="text-lg font-medium text-gray-800">
                {summaryTitle}
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {summarySubtitle}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">
                    Income
                  </div>
                  <div className="text-base sm:text-lg md:text-xl font-bold text-green-700 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {formatCurrency(income, currency)}
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-sm text-red-600 font-medium">
                    Expenses
                  </div>
                  <div className="text-base sm:text-lg md:text-xl font-bold text-red-700 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {formatCurrency(expense, currency)}
                  </div>
                </div>
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
                    className={`text-base sm:text-lg md:text-xl font-bold leading-tight break-nowrap overflow-hidden text-ellipsis ${
                      net >= 0 ? 'text-blue-700' : 'text-orange-700'
                    }`}
                  >
                    {formatCurrency(net, currency)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="bg-white rounded-lg shadow-md p-4 flex-1 space-y-8">
            {/* EXPENSES CHART */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                {expenseChartTitle}
              </h3>

              {expenseChartData.length === 0 ? (
                <div className="text-center text-gray-500">
                  No data to draw expenses chart.
                </div>
              ) : (
                  {avgExpense > 0 && (
                  <div className="text-right text-sm font-semibold text-gray-600 mb-1">
                    Avg: {formatCurrency(avgExpense, currency)}
                  </div>
                )}
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={expenseChartData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={
                        isYearly
                          ? 'monthLabel'
                          : isMonthAcrossYears
                          ? 'yearLabel'
                          : 'category'
                      }
                      angle={!isYearly && !isMonthAcrossYears ? -30 : 0}
                      textAnchor={
                        !isYearly && !isMonthAcrossYears ? 'end' : 'middle'
                      }
                      height={
                        !isYearly && !isMonthAcrossYears ? 70 : undefined
                      }
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(Number(value ?? 0), currency)
                      }
                    />
                    {avgExpense > 0 && (
                      <ReferenceLine
                              y={avgExpense}
                              stroke="#4b5563"
                              strokeDasharray="4 4"
                              ifOverflow="extendDomain"
                            />
                    )}
                    {isYearly || isMonthAcrossYears ? (
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

            {/* INCOME CHART */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                {incomeChartTitle}
              </h3>

              {incomeChartData.length === 0 ? (
                <div className="text-center text-gray-500">
                  No data to draw income chart.
                </div>
              ) : (
                    {avgIncome > 0 && (
                  <div className="text-right text-sm font-semibold text-gray-600 mb-1">
                    Avg: {formatCurrency(avgIncome, currency)}
                  </div>
                )}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={incomeChartData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={
                        isYearly
                          ? 'monthLabel'
                          : isMonthAcrossYears
                          ? 'yearLabel'
                          : 'category'
                      }
                      angle={!isYearly && !isMonthAcrossYears ? -30 : 0}
                      textAnchor={
                        !isYearly && !isMonthAcrossYears ? 'end' : 'middle'
                      }
                      height={
                        !isYearly && !isMonthAcrossYears ? 70 : undefined
                      }
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(Number(value ?? 0), currency)
                      }
                    />
                    {avgIncome > 0 && (
                      <ReferenceLine
                        y={avgIncome}
                        stroke="#4b5563"
                        strokeDasharray="4 4"
                      />
                    )}
                    {isYearly || isMonthAcrossYears ? (
                      <Bar
                          dataKey="income"
                          name="Income"
                          shape={(props: any) => {
                            const { x, y, width, height, payload } = props;
                            const color = payload?.category
                              ? getCategoryColor(payload.category)?.backgroundColor || '#22c55e'
                              : '#22c55e';
                            return (
                              <rect
                                x={x}
                                y={y}
                                width={width}
                                height={height}
                                fill={color}
                                rx={6}     // FIX: rounded corners
                              />
                            );
                          }}
                        />
                    ) : (
                      <Bar
                        dataKey="income"
                        name="Income"
                        shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const color = payload?.category
                            ? getCategoryColor(payload.category)
                                ?.backgroundColor || '#22c55e'
                            : '#22c55e';
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
    </div>
  );
}
