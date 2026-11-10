import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DepartmentCode } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { semesterPosition, SEMESTER_MONTHS } from '../lib/budgetForecast';
import {
  Sparkles,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Building2,
  BarChart3,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  Trees
} from 'lucide-react';

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const pesoK = (n: number) => `₱${(n / 1000).toFixed(1)}k`;

const CATEGORY_LABELS: Record<string, string> = {
  Academic: 'Academic & Colloquiums',
  Event: 'Events & Assemblies',
  Operations: 'Operations',
  Capital: 'Capital & Equipment'
};
// Used when the scope has no expense transactions to learn category shares from.
const DEFAULT_CATEGORY_SHARES: Record<string, number> = { Academic: 0.45, Event: 0.25, Operations: 0.15, Capital: 0.15 };

const STATUS_STYLES: Record<string, string> = {
  'On Track': 'bg-blue-50 text-blue-900 border-blue-200',
  'Deficit Risk': 'bg-rose-50 text-rose-800 border-rose-200',
  'Under-utilization': 'bg-amber-50 text-amber-900 border-amber-200',
  'No Allocation': 'bg-slate-100 text-slate-600 border-slate-200'
};

export const MLForecastView: React.FC = () => {
  const {
    forecastMetric,
    userDepartment,
    isDepartmentRestricted,
    activeSemester,
    scopedTransactions
  } = useApp();

  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>(isDepartmentRestricted ? userDepartment : 'ALL');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'comparison' | 'insights'>('overview');

  const scopeCode = isDepartmentRestricted ? userDepartment : selectedDeptFilter;
  const scopeLabel = scopeCode === 'ALL' ? 'All Departments' : scopeCode;

  const displayDepartments = forecastMetric.departments.filter(d => scopeCode === 'ALL' || d.code === scopeCode);

  const { monthsElapsed, monthLabels, startMonth, calendarYear } = useMemo(
    () => semesterPosition(activeSemester, new Date()),
    [activeSemester]
  );

  // Aggregate the per-department Random Forest output for the current scope.
  const scope = useMemo(() => {
    const allocated = displayDepartments.reduce((s, d) => s + d.allocated, 0);
    const spent = displayDepartments.reduce((s, d) => s + d.spent, 0);
    const forecast = displayDepartments.reduce((s, d) => s + d.forecast, 0);
    const trajectory = Array.from({ length: SEMESTER_MONTHS }, (_, i) => {
      const predicted = displayDepartments.reduce((s, d) => s + d.trajectory[i].predicted, 0);
      // Combine per-department interval half-widths assuming independent errors.
      const halfUp = Math.sqrt(displayDepartments.reduce((s, d) => s + (d.trajectory[i].upper - d.trajectory[i].predicted) ** 2, 0));
      const halfDown = Math.sqrt(displayDepartments.reduce((s, d) => s + (d.trajectory[i].predicted - d.trajectory[i].lower) ** 2, 0));
      return { predicted, lower: Math.max(0, predicted - halfDown), upper: predicted + halfUp };
    });
    const final = trajectory[SEMESTER_MONTHS - 1];
    return { allocated, spent, forecast, trajectory, lower: final.lower, upper: final.upper };
  }, [displayDepartments]);

  const scopeTransactions = useMemo(
    () => scopedTransactions.filter(t => t.type === 'EXPENSE' && t.status !== 'Rejected' && (scopeCode === 'ALL' || t.department === scopeCode)),
    [scopedTransactions, scopeCode]
  );

  // Actual cumulative spend for completed months, from ISO-dated expense transactions.
  const monthlyActuals = useMemo(() => {
    const perMonth = new Array(SEMESTER_MONTHS).fill(0);
    let found = false;
    scopeTransactions.forEach(t => {
      if (!/^\d{4}-\d{2}-\d{2}/.test(t.date)) return;
      const d = new Date(t.date);
      const idx = (d.getFullYear() - calendarYear) * 12 + d.getMonth() - startMonth;
      if (idx >= 0 && idx < SEMESTER_MONTHS) {
        perMonth[idx] += t.amount;
        found = true;
      }
    });
    if (!found) return null;
    let running = 0;
    return perMonth.map(v => (running += v));
  }, [scopeTransactions, calendarYear, startMonth]);

  const monthlyTrajectory = scope.trajectory.map((point, i) => {
    const month = i + 1;
    const actual =
      month === monthsElapsed ? scope.spent :
      month < monthsElapsed && monthlyActuals ? monthlyActuals[i] :
      null;
    const status =
      month < monthsElapsed ? 'Completed' :
      month === monthsElapsed ? 'Current' :
      month === SEMESTER_MONTHS ? 'Projected Final' : 'Projected';
    return { month: `${monthLabels[i]} (Month ${month})`, actual, ...point, status };
  });

  // Distribute the forecast across expense categories using historical shares.
  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = { Academic: 0, Event: 0, Operations: 0, Capital: 0 };
    scopeTransactions.forEach(t => {
      if (t.category in totals) totals[t.category] += t.amount;
    });
    const sum = Object.values(totals).reduce((s, v) => s + v, 0);
    const shares = sum > 0
      ? Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / sum]))
      : DEFAULT_CATEGORY_SHARES;
    return Object.keys(CATEGORY_LABELS)
      .map(key => ({
        category: CATEGORY_LABELS[key],
        share: Math.round(shares[key] * 100),
        allocated: Math.round(scope.allocated * shares[key]),
        forecast: Math.round(scope.forecast * shares[key])
      }))
      .sort((a, b) => b.share - a.share);
  }, [scopeTransactions, scope.allocated, scope.forecast]);

  const projectedBalance = scope.allocated - scope.forecast;
  const projectedBalancePct = scope.allocated > 0 ? (projectedBalance / scope.allocated) * 100 : 0;
  const utilToDate = scope.allocated > 0 ? scope.spent / scope.allocated : 0;
  const historicalUtilNow = forecastMetric.historical_util_by_month[monthsElapsed - 1] ?? 0;
  const paceGap = (utilToDate - historicalUtilNow) * 100;
  const maxImportance = Math.max(...forecastMetric.feature_importances.map(f => f.importance), 0.0001);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-3xl text-white shadow-lg border border-slate-700/50">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-400 backdrop-blur-xs">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex flex-wrap items-center gap-2">
                Machine Learning Budget Forecast Engine
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                  {forecastMetric.model_name}
                </span>
              </h1>
              <p className="text-xs text-slate-300">
                {forecastMetric.n_trees}-tree Random Forest ensemble predicting end-of-semester expenditure for {activeSemester.school_year_label}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isDepartmentRestricted && (
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white/10 text-white rounded-xl border border-white/20 font-semibold"
            >
              <option value="ALL" className="text-slate-900">All 8 Departments</option>
              {Object.keys(DEPARTMENTS).map(code => (
                <option key={code} value={code} className="text-slate-900">{code} - {DEPARTMENTS[code as DepartmentCode].name}</option>
              ))}
            </select>
          )}
          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Holdout Fit (R²)</span>
            <span className="text-lg font-black text-emerald-400">{(forecastMetric.r2 * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Model Benchmark Performance Cards (measured on the most recent held-out school year) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">R² Coefficient</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{forecastMetric.r2.toFixed(3)}</p>
          <p className="text-[11px] text-emerald-700 font-semibold">{(forecastMetric.r2 * 100).toFixed(1)}% Variance Explained</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Mean Absolute Error (MAE)</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{peso(forecastMetric.mae)}</p>
          <p className="text-[11px] text-slate-500 font-medium">Avg error per department-semester</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Root Mean Sq Error (RMSE)</span>
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{peso(forecastMetric.rmse)}</p>
          <p className="text-[11px] text-purple-700 font-semibold">Trained on {forecastMetric.training_years} S/Y Data</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">MAPE Error Rate</span>
            <Percent className="w-4 h-4 text-amber-600" />
          </div>
          <p className={`text-2xl font-black ${forecastMetric.mape <= 10 ? 'text-emerald-700' : 'text-amber-700'}`}>{forecastMetric.mape}%</p>
          <p className="text-[11px] text-slate-500 font-medium">Industry Standard ≤ 10%</p>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-2xs">
        {([
          { key: 'overview', label: 'Expenditure Forecast & Trajectory', icon: BarChart3 },
          { key: 'comparison', label: 'Department Variance Table', icon: Building2 },
          { key: 'insights', label: 'AI Risk & Optimization Alerts', icon: Zap }
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeSubTab === tab.key ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & MONTHLY TRAJECTORY */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>Semester Expenditure Trajectory vs. ML Projection</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold">
                    {scopeLabel}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Actual disbursed funds vs. Random Forest predicted cumulative spending, with 95% prediction interval
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                  <span className="text-slate-700">Actual Spent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                  <span className="text-slate-700">ML Forecast</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {monthlyTrajectory.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition space-y-3 ${
                    item.status === 'Current'
                      ? 'bg-amber-50/70 border-amber-200 shadow-xs'
                      : item.status === 'Completed'
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-xs text-slate-900">{item.month}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                      item.status === 'Current' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {item.actual !== null ? (
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Actual Disbursed</span>
                        <p className="font-black text-sm text-emerald-800">{peso(item.actual)}</p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {item.status === 'Completed' ? 'Model Back-cast' : 'Predicted Cumulative'}
                        </span>
                        <p className="font-black text-sm text-purple-700">{peso(item.predicted)}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex justify-between font-mono">
                      <span>Band:</span>
                      <span>{pesoK(item.lower)} - {pesoK(item.upper)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <span>{scopeLabel} Categorical ML Forecast Distribution</span>
                <span className="text-xs text-slate-400 font-normal">(Forecast split by historical spending mix)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {categoryBreakdown.map((cat, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">{cat.category}</span>
                      <span className="text-[10px] font-black text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                        {cat.share}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00873E] rounded-full" style={{ width: `${cat.share}%` }}></div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 text-[11px]">Allocated: {peso(cat.allocated)}</span>
                      <span className="font-bold text-slate-900">Forecast: {peso(cat.forecast)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENT VARIANCE TABLE */}
      {activeSubTab === 'comparison' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="font-black text-slate-900 text-sm">Department-by-Department Variance Matrix</h3>
            <p className="text-xs text-slate-500">Allocated budget vs. Random Forest forecasted end-of-semester expenditure</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Department / College</th>
                    <th className="py-3.5 px-4 text-right">Allocated Fund (₱)</th>
                    <th className="py-3.5 px-4 text-right">ML Forecast (₱)</th>
                    <th className="py-3.5 px-4 text-right">Projected Variance (₱)</th>
                    <th className="py-3.5 px-4 text-center">Confidence Index</th>
                    <th className="py-3.5 px-4 text-center">Status / Risk Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayDepartments.map((dept) => {
                    const balance = dept.allocated - dept.forecast;
                    const isSurplus = balance >= 0;
                    const deptMeta = DEPARTMENTS[dept.code];

                    return (
                      <tr key={dept.code} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black border ${deptMeta?.badgeBg || 'bg-slate-100'}`}>
                              {dept.code}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">{dept.name}</p>
                              <p className="text-[11px] text-slate-500">Naga College Foundation</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {peso(dept.allocated)}.00
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-purple-700">
                          {peso(dept.forecast)}.00
                          <p className="text-[10px] font-normal text-slate-400">{pesoK(dept.lower)} – {pesoK(dept.upper)}</p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {isSurplus ? (
                            <span className="text-emerald-700 flex items-center justify-end gap-1">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              +{peso(balance)}.00 (Surplus)
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center justify-end gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              -{peso(Math.abs(balance))}.00 (Deficit Risk)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-black text-[11px]">
                            {dept.confidence}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 border rounded-full font-bold text-[10px] ${STATUS_STYLES[dept.status] || STATUS_STYLES['On Track']}`}>
                            {dept.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI RISK & OPTIMIZATION ALERTS */}
      {activeSubTab === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              {projectedBalance >= 0
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                : <AlertTriangle className="w-5 h-5 text-rose-600" />}
              <h4 className="font-extrabold text-sm text-slate-900">Fiscal Reserve Health Signal</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              The Random Forest projects {scopeLabel} to spend <strong>{peso(scope.forecast)}</strong> of its{' '}
              <strong>{peso(scope.allocated)}</strong> allocation by semester end (95% interval {pesoK(scope.lower)} – {pesoK(scope.upper)}),
              leaving a projected {projectedBalance >= 0 ? 'unspent reserve' : 'shortfall'} of{' '}
              <strong>{peso(Math.abs(projectedBalance))} ({Math.abs(projectedBalancePct).toFixed(1)}%)</strong>.
            </p>
            <div className={`p-3 rounded-xl text-[11px] font-semibold ${projectedBalance >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
              {projectedBalance < 0
                ? 'Recommendation: Review pending proposals and consider a supplementary allocation before the deficit materializes.'
                : projectedBalancePct > 15
                ? 'Recommendation: Significant funds may go unused. Consider fast-tracking planned activities or reallocating.'
                : 'Recommendation: Maintain current proposal submission caps without requiring emergency supplementary funding.'}
            </div>
          </div>

          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${Math.abs(paceGap) > 10 ? 'text-amber-600' : 'text-slate-400'}`} />
              <h4 className="font-extrabold text-sm text-slate-900">Spending Pace vs. History</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              At month {monthsElapsed} of {SEMESTER_MONTHS}, {scopeLabel} has used <strong>{(utilToDate * 100).toFixed(1)}%</strong> of its
              budget. Past semesters averaged <strong>{(historicalUtilNow * 100).toFixed(1)}%</strong> by this point,
              so spending is running <strong>{Math.abs(paceGap).toFixed(1)} pts {paceGap >= 0 ? 'ahead of' : 'behind'}</strong> the usual pace.
            </p>
            <div className="p-3 bg-amber-50 rounded-xl text-[11px] text-amber-900 font-semibold">
              {paceGap > 10
                ? 'Recommendation: Spending is front-loaded. Hold non-essential disbursements until late-semester needs are confirmed.'
                : paceGap < -10
                ? 'Recommendation: Spending is lagging. Make sure liquidation and cash-out requests are being filed on time.'
                : 'Recommendation: Pace is in line with history. Keep triggering liquidation vouchers promptly after events.'}
            </div>
          </div>

          <div className="md:col-span-2 p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Trees className="w-5 h-5 text-emerald-600" />
              <h4 className="font-extrabold text-sm text-slate-900">What Drives the Forecast (Random Forest Feature Importance)</h4>
            </div>
            <div className="space-y-2">
              {forecastMetric.feature_importances.map(f => (
                <div key={f.feature} className="flex items-center gap-3 text-xs">
                  <span className="w-40 shrink-0 font-semibold text-slate-700">{f.label}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#00873E] rounded-full" style={{ width: `${(f.importance / maxImportance) * 100}%` }}></div>
                  </div>
                  <span className="w-12 text-right font-mono text-slate-600">{(f.importance * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Share of total error reduction contributed by each input across all {forecastMetric.n_trees} trees.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MLForecastView;
