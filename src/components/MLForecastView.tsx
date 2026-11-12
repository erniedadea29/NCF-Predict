import React, { Fragment, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { BudgetRequestPrediction, DepartmentCode } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { MODEL_ALGORITHMS, MODEL_COMPARISON, TRAINING_DATASET } from '../data/modelComparison';
import { PREDICT_API_URL } from '../lib/predictionApi';
import {
  Sparkles, Cpu, AlertTriangle, CheckCircle2, Building2, BarChart3, Percent, Activity,
  RefreshCw, ChevronDown, ChevronRight, Trophy, Wifi, WifiOff, FileText
} from 'lucide-react';

const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

const FLAG_STYLES: Record<string, string> = {
  OVER: 'bg-rose-50 text-rose-700 border-rose-200',
  UNDER: 'bg-amber-50 text-amber-800 border-amber-200',
  OK: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};
const FLAG_LABELS: Record<string, string> = {
  OVER: 'Over estimate (>25%)',
  UNDER: 'Under estimate (>25%)',
  OK: 'Within ±25%'
};
const flagFor = (variancePct: number) => (variancePct > 25 ? 'OVER' : variancePct < -25 ? 'UNDER' : 'OK');

export const MLForecastView: React.FC = () => {
  const {
    scopedProposals,
    requestPredictions,
    trainedModel,
    predictionApiOnline,
    runBudgetPrediction,
    isDepartmentRestricted,
    userDepartment,
    activeSemester,
    isReadOnlyStudent
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'departments' | 'model'>('requests');
  const [deptFilter, setDeptFilter] = useState<string>(isDepartmentRestricted ? userDepartment : 'ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const scopeCode = isDepartmentRestricted ? userDepartment : deptFilter;
  const proposals = scopedProposals.filter(p => scopeCode === 'ALL' || p.department === scopeCode);

  const rows = proposals.map(p => ({ proposal: p, prediction: requestPredictions[p.id] as BudgetRequestPrediction | undefined }));
  const predicted = rows.filter(r => r.prediction);

  const totals = useMemo(() => {
    const requested = predicted.reduce((s, r) => s + r.prediction!.requested_total, 0);
    const predictedTotal = predicted.reduce((s, r) => s + r.prediction!.predicted_total, 0);
    return {
      requested,
      predicted: predictedTotal,
      variancePct: predictedTotal ? ((requested - predictedTotal) / predictedTotal) * 100 : 0,
      flagged: predicted.filter(r => flagFor(r.prediction!.variance_pct) !== 'OK').length
    };
  }, [predicted]);

  const byDepartment = useMemo(() => {
    const map: Partial<Record<DepartmentCode, { count: number; predictedCount: number; requested: number; predicted: number; flagged: number }>> = {};
    rows.forEach(({ proposal, prediction }) => {
      const d = (map[proposal.department] ??= { count: 0, predictedCount: 0, requested: 0, predicted: 0, flagged: 0 });
      d.count += 1;
      if (prediction) {
        d.predictedCount += 1;
        d.requested += prediction.requested_total;
        d.predicted += prediction.predicted_total;
        if (flagFor(prediction.variance_pct) !== 'OK') d.flagged += 1;
      }
    });
    return Object.entries(map).map(([code, v]) => ({ code: code as DepartmentCode, ...v! }));
  }, [rows]);

  const handlePredict = async (id: string) => {
    setBusy(id);
    setMessage(null);
    const res = await runBudgetPrediction(id);
    setBusy(null);
    setMessage({ ok: res.success, text: res.message });
    if (res.success) setExpanded(id);
  };

  const metric = (key: string) => trainedModel?.metrics?.[key];
  const fallback = (name: string) => MODEL_COMPARISON.find(m => m.metric === name)?.values['Random Forest'] ?? 0;
  const r2Line = metric('R2 (line item)') ?? fallback('R² (line item)');
  const maeLine = metric('MAE line (PHP)') ?? fallback('MAE line item');
  const maeEvent = metric('MAE event (PHP)') ?? fallback('MAE event total');
  const accuracy = metric('Accuracy event (100-MAPE %)') ?? fallback('Accuracy event (100 − MAPE %)');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-3xl text-white shadow-lg border border-slate-700/50">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex flex-wrap items-center gap-2">
              Machine Learning Budget Estimator
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                {trainedModel?.algorithm || 'Random Forest'}{trainedModel ? ` • model #${trainedModel.id}` : ''}
              </span>
            </h1>
            <p className="text-xs text-slate-300">
              Trained on {TRAINING_DATASET.rows} budget line items from {TRAINING_DATASET.events} NCF events ({TRAINING_DATASET.years}).
              Predicts each item's cost and compares it with what was requested • {activeSemester.school_year_label}
            </p>
            <span
              title={PREDICT_API_URL}
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                predictionApiOnline ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                : predictionApiOnline === false ? 'bg-rose-500/15 border-rose-400/30 text-rose-300'
                : 'bg-white/10 border-white/20 text-slate-300'
              }`}
            >
              {predictionApiOnline === false ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
              {predictionApiOnline ? 'Prediction API online' : predictionApiOnline === false ? 'Prediction API offline: saved results only' : 'Checking prediction API...'}
            </span>
          </div>
        </div>
        {!isDepartmentRestricted && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white/10 text-white rounded-xl border border-white/20 font-semibold"
          >
            <option value="ALL" className="text-slate-900">All 8 Departments</option>
            {Object.keys(DEPARTMENTS).map(code => (
              <option key={code} value={code} className="text-slate-900">{code} - {DEPARTMENTS[code as DepartmentCode].name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Model performance (cross-validated on unseen events) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Event Accuracy', value: `${accuracy.toFixed(1)}%`, note: '100 − MAPE on unseen events', icon: Percent, color: 'text-emerald-600' },
          { label: 'R² (line item)', value: r2Line.toFixed(3), note: `${(r2Line * 100).toFixed(1)}% variance explained`, icon: Sparkles, color: 'text-emerald-600' },
          { label: 'MAE per Item', value: peso(maeLine), note: 'Average error per line item', icon: Activity, color: 'text-blue-600' },
          { label: 'MAE per Event', value: peso(maeEvent), note: 'Average error per event total', icon: BarChart3, color: 'text-purple-600' }
        ].map(card => (
          <div key={card.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">{card.label}</span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-2xl font-black text-slate-900">{card.value}</p>
            <p className="text-[11px] text-slate-500 font-medium">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-2xs">
        {([
          { key: 'requests', label: 'Budget Requests vs Model', icon: FileText },
          { key: 'departments', label: 'Department Summary', icon: Building2 },
          { key: 'model', label: 'Model Comparison', icon: Trophy }
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

      {message && (
        <div className={`p-3 rounded-xl text-xs border ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {message.text}
        </div>
      )}

      {/* TAB 1: per-request comparison */}
      {activeSubTab === 'requests' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500">Requested (predicted requests)</span>
              <p className="text-lg font-black text-slate-900">{peso(totals.requested)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500">Model Estimate</span>
              <p className="text-lg font-black text-purple-700">{peso(totals.predicted)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500">Requested vs Estimate</span>
              <p className={`text-lg font-black ${Math.abs(totals.variancePct) > 25 ? 'text-rose-600' : 'text-emerald-700'}`}>{pct(totals.variancePct)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500">Flagged Requests</span>
              <p className="text-lg font-black text-amber-700">{totals.flagged} <span className="text-xs font-semibold text-slate-400">of {predicted.length} predicted</span></p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 w-6"></th>
                    <th className="py-3 px-3">Budget Request</th>
                    <th className="py-3 px-3 text-right">Requested</th>
                    <th className="py-3 px-3 text-right">Model Estimate</th>
                    <th className="py-3 px-3 text-center">Difference</th>
                    <th className="py-3 px-3 text-center">Assessment</th>
                    {!isReadOnlyStudent && <th className="py-3 px-3"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-400">No budget requests yet.</td></tr>
                  )}
                  {rows.map(({ proposal, prediction }) => {
                    const flag = prediction ? flagFor(prediction.variance_pct) : null;
                    const isOpen = expanded === proposal.id;
                    return (
                      <Fragment key={proposal.id}>
                        <tr className="hover:bg-slate-50/80">
                          <td className="py-3 px-3">
                            {prediction && (
                              <button onClick={() => setExpanded(isOpen ? null : proposal.id)} className="text-slate-400 hover:text-slate-700 cursor-pointer" title="Show items">
                                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${DEPARTMENTS[proposal.department]?.badgeBg || 'bg-slate-100'}`}>{proposal.department}</span>
                              <span className="font-bold text-slate-900">{proposal.budget_title}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {proposal.budget_status.replace(/_/g, ' ')}
                              {prediction?.has_low_confidence_items ? ' • some categories not in training data' : ''}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{peso(prediction?.requested_total ?? proposal.total_budget_amount)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-purple-700">{prediction ? peso(prediction.predicted_total) : <span className="text-slate-400 font-sans font-normal">Not predicted yet</span>}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {prediction ? <span className={Math.abs(prediction.variance_pct) > 25 ? 'text-rose-600' : 'text-slate-700'}>{pct(prediction.variance_pct)}</span> : '—'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {flag && (
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${FLAG_STYLES[flag]}`}>
                                {FLAG_LABELS[flag]}{prediction!.items_over > 0 ? ` • ${prediction!.items_over} item(s) over` : ''}
                              </span>
                            )}
                          </td>
                          {!isReadOnlyStudent && (
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handlePredict(proposal.id)}
                                disabled={busy === proposal.id || proposal.line_items.length === 0}
                                title={proposal.line_items.length === 0 ? 'This request has no line items' : 'Run the trained model on this request'}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-[11px] font-bold cursor-pointer disabled:cursor-not-allowed"
                              >
                                <RefreshCw className={`w-3 h-3 ${busy === proposal.id ? 'animate-spin' : ''}`} />
                                {prediction ? 'Re-predict' : 'Predict'}
                              </button>
                            </td>
                          )}
                        </tr>
                        {isOpen && prediction && (
                          <tr className="bg-slate-50/60">
                            <td></td>
                            <td colSpan={6} className="py-3 px-3">
                              <table className="w-full text-[11px]">
                                <thead className="text-slate-500 font-bold">
                                  <tr>
                                    <th className="py-1 text-left">Item</th>
                                    <th className="py-1 text-left">Category (model)</th>
                                    <th className="py-1 text-right">Qty</th>
                                    <th className="py-1 text-right">Est. Unit Cost</th>
                                    <th className="py-1 text-right">Requested</th>
                                    <th className="py-1 text-right">Estimate</th>
                                    <th className="py-1 text-center">Diff</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {prediction.items.map((it, i) => (
                                    <tr key={it.request_item_id || i}>
                                      <td className="py-1.5 font-semibold text-slate-800">{it.item}</td>
                                      <td className="py-1.5 text-slate-600">
                                        {it.model_category}
                                        {it.low_confidence && <span className="ml-1 text-amber-700" title="Category not in training data: less reliable">⚠</span>}
                                      </td>
                                      <td className="py-1.5 text-right">{it.qty}</td>
                                      <td className="py-1.5 text-right font-mono">{peso(it.pred_unit_cost)}</td>
                                      <td className="py-1.5 text-right font-mono">{peso(it.requested_amount)}</td>
                                      <td className="py-1.5 text-right font-mono text-purple-700">{peso(it.pred_subtotal)}</td>
                                      <td className="py-1.5 text-center">
                                        <span className={`px-1.5 py-0.5 rounded border font-bold ${FLAG_STYLES[it.flag]}`}>{pct(it.variance_pct)}</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <p className="text-[10px] text-slate-400 mt-2">Predicted {new Date(prediction.predicted_at).toLocaleString('en-US')} • model #{prediction.model_id ?? '—'}</p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            The estimate is what similar items cost at past NCF events. Requests more than 25% above (OVER) or below (UNDER) it are flagged for the Adviser and Dean to double-check;
            a flag is a prompt to review, not an automatic rejection.
          </p>
        </div>
      )}

      {/* TAB 2: department summary */}
      {activeSubTab === 'departments' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Requests (predicted)</th>
                  <th className="py-3 px-4 text-right">Requested</th>
                  <th className="py-3 px-4 text-right">Model Estimate</th>
                  <th className="py-3 px-4 text-center">Difference</th>
                  <th className="py-3 px-4 text-center">Flagged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byDepartment.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400">No budget requests yet.</td></tr>
                )}
                {byDepartment.map(d => {
                  const variance = d.predicted ? ((d.requested - d.predicted) / d.predicted) * 100 : 0;
                  return (
                    <tr key={d.code} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black border ${DEPARTMENTS[d.code]?.badgeBg || 'bg-slate-100'}`}>{d.code}</span>
                        <span className="ml-2 font-bold text-slate-900">{DEPARTMENTS[d.code]?.name}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">{d.count} ({d.predictedCount})</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{peso(d.requested)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">{peso(d.predicted)}</td>
                      <td className={`py-3 px-4 text-center font-mono font-bold ${Math.abs(variance) > 25 ? 'text-rose-600' : 'text-slate-700'}`}>{d.predicted ? pct(variance) : '—'}</td>
                      <td className="py-3 px-4 text-center">
                        {d.flagged > 0
                          ? <span className="inline-flex items-center gap-1 text-amber-700 font-bold"><AlertTriangle className="w-3.5 h-3.5" />{d.flagged}</span>
                          : <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><CheckCircle2 className="w-3.5 h-3.5" />0</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: algorithm comparison (thesis results) */}
      {activeSubTab === 'model' && (
        <div className="space-y-3">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Metric</th>
                    {MODEL_ALGORITHMS.map(a => <th key={a} className="py-3 px-4 text-right">{a}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MODEL_COMPARISON.map(row => {
                    const vals = MODEL_ALGORITHMS.map(a => row.values[a]);
                    const best = row.higherIsBetter ? Math.max(...vals) : Math.min(...vals);
                    return (
                      <tr key={row.metric}>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{row.metric}</td>
                        {MODEL_ALGORITHMS.map(a => {
                          const v = row.values[a];
                          return (
                            <td key={a} className={`py-2.5 px-4 text-right font-mono ${v === best ? 'font-black text-emerald-700' : 'text-slate-600'}`}>
                              {row.peso ? peso(v) : v.toFixed(row.metric.startsWith('R²') ? 3 : 1)}{v === best ? ' ★' : ''}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Each algorithm was tuned with a hyperparameter grid and scored with repeated GroupKFold by event (5 folds × 3 repeats),
            so every score is for events the model never saw. Random Forest ranked 1st on every metric (★) and is the deployed model.
          </p>
        </div>
      )}
    </div>
  );
};

export default MLForecastView;
