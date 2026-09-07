import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DepartmentCode } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Cpu, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  Sliders, 
  BarChart3, 
  RefreshCw, 
  FileDown, 
  ShieldCheck, 
  Calendar, 
  DollarSign, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  Zap,
  HelpCircle
} from 'lucide-react';

export const MLForecastView: React.FC = () => {
  const { 
    forecastMetric, 
    userDepartment, 
    isDepartmentRestricted, 
    scopedDepartmentInfo, 
    scopedDepartmentList,
    activeSemester,
    departments
  } = useApp();

  // Scenario Simulator Interactive State
  const [enrollmentShift, setEnrollmentShift] = useState<number>(0); // percentage shift -20 to +30
  const [collectionEfficiency, setCollectionEfficiency] = useState<number>(95); // 70 to 100%
  const [inflationRate, setInflationRate] = useState<number>(4.5); // 0 to 12%
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>(isDepartmentRestricted ? userDepartment : 'ALL');

  // Active Tab within Forecast View
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'comparison' | 'simulator' | 'insights'>('overview');

  // Month-by-month trajectory data for time-series visualization
  const monthlyTrajectory = [
    { month: 'Aug (Month 1)', actual: 12400, predicted: 13000, lowerBound: 11800, upperBound: 14200, status: 'Completed' },
    { month: 'Sep (Month 2)', actual: 28900, predicted: 29500, lowerBound: 27500, upperBound: 31500, status: 'Completed' },
    { month: 'Oct (Month 3)', actual: null, predicted: 48200, lowerBound: 45000, upperBound: 51400, status: 'Projected Peak' },
    { month: 'Nov (Month 4)', actual: null, predicted: 67000, lowerBound: 63200, upperBound: 70800, status: 'Projected' },
    { month: 'Dec (Month 5)', actual: null, predicted: 79200, lowerBound: 75000, upperBound: 83400, status: 'Projected Final' }
  ];

  // Categorical breakdown for designated department (e.g. CAF)
  const categoryBreakdown = [
    { category: 'Academic & Colloquiums', allocated: 40000, forecast: 38200, variance: -1800, share: 48 },
    { category: 'Operations & Assemblies', allocated: 20000, forecast: 18500, variance: -1500, share: 23 },
    { category: 'Capital & Equipment', allocated: 15000, forecast: 13800, variance: -1200, share: 17 },
    { category: 'Contingency & Reserves', allocated: 10000, forecast: 8700, variance: -1300, share: 12 }
  ];

  // Filtered department forecast rows
  const displayDepartments = forecastMetric.departments.filter(dept => {
    if (isDepartmentRestricted) {
      return dept.code === userDepartment;
    }
    if (selectedDeptFilter !== 'ALL') {
      return dept.code === selectedDeptFilter;
    }
    return true;
  });

  // Calculate dynamic simulator results based on slider inputs
  const simulatedFactor = (1 + enrollmentShift / 100) * (collectionEfficiency / 95) * (1 + (inflationRate - 4.5) / 100);
  const baseTotalForecast = isDepartmentRestricted 
    ? (forecastMetric.departments.find(d => d.code === userDepartment)?.forecast || 79200)
    : forecastMetric.departments.reduce((sum, d) => sum + d.forecast, 0);

  const simulatedTotalForecast = Math.round(baseTotalForecast * simulatedFactor);
  const baseAllocated = isDepartmentRestricted 
    ? (scopedDepartmentInfo.allocated || 85000)
    : forecastMetric.departments.reduce((sum, d) => sum + d.allocated, 0);

  const simulatedDiff = baseAllocated - simulatedTotalForecast;
  const isSurplus = simulatedDiff >= 0;

  const handleResetSimulator = () => {
    setEnrollmentShift(0);
    setCollectionEfficiency(95);
    setInflationRate(4.5);
  };

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
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                Machine Learning Budget Forecast Engine
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                  {forecastMetric.model_name}
                </span>
              </h1>
              <p className="text-xs text-slate-300">
                Predictive expenditure modeling, variance risk analytics, and dynamic simulation for {activeSemester.school_year_label}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Model Precision (R²)</span>
            <span className="text-lg font-black text-emerald-400">{(forecastMetric.r2 * 100).toFixed(1)}% Accuracy</span>
          </div>
        </div>
      </div>

      {/* Model Benchmark Performance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">R² Coefficient</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{forecastMetric.r2}</p>
          <p className="text-[11px] text-emerald-700 font-semibold">94.3% Variance Explained</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Mean Absolute Error (MAE)</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">₱{forecastMetric.mae.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 font-medium">Avg variance per semester</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Root Mean Sq Error (RMSE)</span>
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">₱{forecastMetric.rmse.toLocaleString()}</p>
          <p className="text-[11px] text-purple-700 font-semibold">Trained on {forecastMetric.training_years} S/Y Data</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">MAPE Error Rate</span>
            <Percent className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{forecastMetric.mape}%</p>
          <p className="text-[11px] text-slate-500 font-medium">Industry Standard ≤ 10%</p>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-2xs">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'overview' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Expenditure Forecast & Trajectory</span>
        </button>
        <button
          onClick={() => setActiveSubTab('comparison')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'comparison' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Department Variance Table</span>
        </button>
        <button
          onClick={() => setActiveSubTab('simulator')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'simulator' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>What-If Scenario Simulator</span>
        </button>
        <button
          onClick={() => setActiveSubTab('insights')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'insights' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>AI Risk & Optimization Alerts</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & MONTHLY TRAJECTORY */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Visual Comparison Banner */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>Semester Expenditure Trajectory vs. ML Projection</span>
                  {isDepartmentRestricted && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold">
                      {userDepartment} Focus
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500">
                  Comparison between Actual Disbursed Funds and ARIMA-LSTM Predicted Spending Curve with 95% Confidence Interval
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
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-purple-100 border border-purple-300"></span>
                  <span className="text-slate-500">95% Conf. Band</span>
                </div>
              </div>
            </div>

            {/* Trajectory Table / Visual Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {monthlyTrajectory.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-2xl border transition space-y-3 ${
                    item.status === 'Projected Peak'
                      ? 'bg-amber-50/70 border-amber-200 shadow-xs'
                      : item.actual !== null
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">{item.month}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                      item.status === 'Projected Peak' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {item.actual !== null ? (
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Actual Disbursed</span>
                        <p className="font-black text-sm text-emerald-800">₱{item.actual.toLocaleString()}</p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Predicted Target</span>
                        <p className="font-black text-sm text-purple-700">₱{item.predicted.toLocaleString()}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex justify-between font-mono">
                      <span>Band:</span>
                      <span>₱{(item.lowerBound / 1000).toFixed(1)}k - ₱{(item.upperBound / 1000).toFixed(1)}k</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Scoped Department Breakdown by Expense Category */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <span>{userDepartment} Categorical ML Forecast Distribution</span>
                <span className="text-xs text-slate-400 font-normal">(Estimated by Activity Type)</span>
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
                      <div className="h-full bg-[#00873E] rounded-full" style={{ width: `${cat.share * 2}%` }}></div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 text-[11px]">Allocated: ₱{cat.allocated.toLocaleString()}</span>
                      <span className="font-bold text-slate-900">Forecast: ₱{cat.forecast.toLocaleString()}</span>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <h3 className="font-black text-slate-900 text-sm">Department-by-Department Variance Matrix</h3>
              <p className="text-xs text-slate-500">Allocated Budget vs ML Machine Learning Forecasted Expenditure</p>
            </div>
            {!isDepartmentRestricted && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-bold">Filter College:</span>
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 font-semibold"
                >
                  <option value="ALL">All 8 Departments</option>
                  {Object.keys(DEPARTMENTS).map(code => (
                    <option key={code} value={code}>{code} - {DEPARTMENTS[code as DepartmentCode].name}</option>
                  ))}
                </select>
              </div>
            )}
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
                    const diff = dept.allocated - dept.forecast;
                    const isPositive = diff >= 0;
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
                          ₱{dept.allocated.toLocaleString()}.00
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-purple-700">
                          ₱{dept.forecast.toLocaleString()}.00
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {isPositive ? (
                            <span className="text-emerald-700 flex items-center justify-end gap-1">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              +₱{diff.toLocaleString()}.00 (Surplus)
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center justify-end gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              -₱{Math.abs(diff).toLocaleString()}.00 (Deficit Risk)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-black text-[11px]">
                            {dept.confidence}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-full font-bold text-[10px]">
                            ✓ Optimal Allocation
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

      {/* TAB 3: WHAT-IF SCENARIO SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                Interactive Predictive Budget Simulator
              </h3>
              <p className="text-xs text-slate-500">
                Simulate macro-variables like student population shifts, collection velocity, and inflation index in real time
              </p>
            </div>
            <button
              onClick={handleResetSimulator}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer self-start"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
            {/* Slider 1: Student Population */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700">Student Enrollment Shift</span>
                <span className={`font-mono ${enrollmentShift >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {enrollmentShift > 0 ? `+${enrollmentShift}%` : `${enrollmentShift}%`}
                </span>
              </div>
              <input
                type="range"
                min="-20"
                max="30"
                step="1"
                value={enrollmentShift}
                onChange={(e) => setEnrollmentShift(parseInt(e.target.value))}
                className="w-full accent-[#00873E] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>-20% Drop</span>
                <span>Baseline (0%)</span>
                <span>+30% Growth</span>
              </div>
            </div>

            {/* Slider 2: SAF Collection Rate */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700">SAF Collection Efficiency</span>
                <span className="text-blue-700 font-mono">{collectionEfficiency}%</span>
              </div>
              <input
                type="range"
                min="70"
                max="100"
                step="1"
                value={collectionEfficiency}
                onChange={(e) => setCollectionEfficiency(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>70% Low</span>
                <span>95% Target</span>
                <span>100% Perfect</span>
              </div>
            </div>

            {/* Slider 3: Inflation & Event Costs */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700">Projected Operational Inflation</span>
                <span className="text-purple-700 font-mono">{inflationRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="0.5"
                value={inflationRate}
                onChange={(e) => setInflationRate(parseFloat(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0% Fixed</span>
                <span>4.5% Est.</span>
                <span>12% High</span>
              </div>
            </div>
          </div>

          {/* Simulation Output Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Baseline Budget Pool</span>
              <p className="text-2xl font-black text-slate-900">₱{baseAllocated.toLocaleString()}.00</p>
              <p className="text-[11px] text-slate-500">{isDepartmentRestricted ? `${userDepartment} Initial Fund` : 'All Departments Combined'}</p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dynamic ML Projection</span>
              <p className="text-2xl font-black text-purple-700">₱{simulatedTotalForecast.toLocaleString()}.00</p>
              <p className="text-[11px] text-slate-500">Adjusted for {enrollmentShift}% shift & {inflationRate}% inflation</p>
            </div>

            <div className={`p-5 rounded-2xl border shadow-2xs space-y-1 ${
              isSurplus ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
            }`}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {isSurplus ? 'Estimated Net Reserve' : 'Estimated Deficit Risk'}
              </span>
              <p className={`text-2xl font-black ${isSurplus ? 'text-emerald-700' : 'text-rose-600'}`}>
                {isSurplus ? `+₱${simulatedDiff.toLocaleString()}.00` : `-₱${Math.abs(simulatedDiff).toLocaleString()}.00`}
              </p>
              <p className="text-[11px] font-medium text-slate-600">
                {isSurplus ? 'Safe fiscal boundary maintained' : 'Warning: Supplementary allocation required'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AI RISK & OPTIMIZATION ALERTS */}
      {activeSubTab === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h4 className="font-extrabold text-sm text-slate-900">Fiscal Reserve Health Signal</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Based on historical data for {userDepartment}, expenditure velocity remains well within safe parameters with a projected unspent reserve of <strong>₱5,800.00 (6.8%)</strong> at semester conclusion.
            </p>
            <div className="p-3 bg-emerald-50 rounded-xl text-[11px] text-emerald-900 font-semibold">
              Recommendation: Maintain current proposal submission caps without requiring emergency supplementary funding.
            </div>
          </div>

          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h4 className="font-extrabold text-sm text-slate-900">Mid-Semester Liquidation Window</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              ML pattern recognition detects that major academic symposiums scheduled in October typically see 8-12% returned unspent budget.
            </p>
            <div className="p-3 bg-amber-50 rounded-xl text-[11px] text-amber-900 font-semibold">
              Recommendation: Ensure Treasury officers trigger liquidation return vouchers promptly upon event completion.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MLForecastView;
