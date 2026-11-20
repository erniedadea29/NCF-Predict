import React from 'react';
import { MODEL_ALGORITHMS, MODEL_COMPARISON, MODEL_COLORS, MODEL_TUNING, TRAINING_DATASET } from '../data/modelComparison';
import { Download, Printer, Trophy, Star } from 'lucide-react';

type Algo = (typeof MODEL_ALGORITHMS)[number];

const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (metric: string, v: number, isPeso?: boolean) =>
  isPeso ? peso(v) : metric.startsWith('R²') ? v.toFixed(3) : `${v.toFixed(1)}%`;

/** Plain-language meaning of each metric, shown under its chart. */
const METRIC_HELP: Record<string, string> = {
  'R² (line item)': 'Share of the variation in each line item’s cost the model explains.',
  'R² (event total)': 'Share of the variation in whole-event totals the model explains.',
  'R² (log unit cost)': 'How well it predicts the price of one unit (what the model learns).',
  'MAE line item': 'Average peso error per line item.',
  'RMSE line item': 'Like MAE, but large errors count more.',
  'MAE event total': 'Average peso error per whole event.',
  'MAPE event (%)': 'Average percent error per whole event.',
  'Accuracy event (100 − MAPE %)': 'Event-level accuracy: 100 minus the percent error.'
};

const rankOf = (metric: (typeof MODEL_COMPARISON)[number], algo: Algo) => {
  const sorted = [...MODEL_ALGORITHMS].sort((a, b) =>
    metric.higherIsBetter ? metric.values[b] - metric.values[a] : metric.values[a] - metric.values[b]
  );
  return sorted.indexOf(algo) + 1;
};

const firstPlaces = (algo: Algo) => MODEL_COMPARISON.filter(m => rankOf(m, algo) === 1).length;

/** One small bar chart per metric: the three models on the same scale. */
const MetricChart: React.FC<{ metric: (typeof MODEL_COMPARISON)[number] }> = ({ metric }) => {
  const max = Math.max(...MODEL_ALGORITHMS.map(a => metric.values[a])) * 1.08;
  return (
    <figure className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 m-0">
      <figcaption className="space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-900">{metric.metric}</span>
          <span className="text-[10px] font-semibold text-slate-500">{metric.higherIsBetter ? 'Higher is better' : 'Lower is better'}</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">{METRIC_HELP[metric.metric]}</p>
      </figcaption>
      <div className="space-y-2" role="img" aria-label={`${metric.metric}: ${MODEL_ALGORITHMS.map(a => `${a} ${fmt(metric.metric, metric.values[a], metric.peso)}`).join(', ')}`}>
        {MODEL_ALGORITHMS.map(a => {
          const v = metric.values[a];
          const best = rankOf(metric, a) === 1;
          return (
            <div
              key={a}
              className="group grid grid-cols-[112px_1fr_auto] items-center gap-2"
              title={`${a}: ${fmt(metric.metric, v, metric.peso)} (rank ${rankOf(metric, a)} of 3)`}
            >
              <span className="text-[11px] text-slate-600 truncate">{a}</span>
              <div className="h-3.5 bg-slate-100 rounded-r-md">
                <div
                  className="h-3.5 rounded-r-[4px] transition-opacity group-hover:opacity-80"
                  style={{ width: `${Math.max(1.5, (v / max) * 100)}%`, backgroundColor: MODEL_COLORS[a] }}
                />
              </div>
              <span className={`text-[11px] font-mono whitespace-nowrap ${best ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                {fmt(metric.metric, v, metric.peso)}
                {best && <Star className="inline w-3 h-3 ml-0.5 -mt-0.5 text-[#B07A00] fill-[#F2B705]" aria-label="best" />}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
};

/** R² (line item) range across every tuned configuration: a narrow range means a stable model. */
const StabilityChart: React.FC = () => {
  const lo = -1.2, hi = 0.6;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Stability across settings</h3>
        <p className="text-[11px] text-slate-500">
          Lowest to highest R² (line item) over every hyperparameter setting tried. A short bar means the model does well whatever the settings.
        </p>
      </div>
      <div className="space-y-3">
        {MODEL_ALGORITHMS.map(a => {
          const t = MODEL_TUNING[a];
          return (
            <div key={a} className="grid grid-cols-[112px_1fr_150px] items-center gap-3" title={`${a}: ${t.r2Min.toFixed(3)} to ${t.r2Max.toFixed(3)} over ${t.configs} settings`}>
              <span className="text-[11px] text-slate-600 truncate">{a}</span>
              <div className="relative h-4 bg-slate-50 rounded">
                <div className="absolute top-0 bottom-0 w-px bg-slate-400" style={{ left: `${pos(0)}%` }} aria-hidden="true" />
                <div
                  className="absolute top-0.5 bottom-0.5 rounded"
                  style={{ left: `${pos(t.r2Min)}%`, width: `${pos(t.r2Max) - pos(t.r2Min)}%`, backgroundColor: MODEL_COLORS[a] }}
                />
              </div>
              <span className="text-[11px] font-mono text-slate-700 whitespace-nowrap">
                {t.r2Min.toFixed(2)} to {t.r2Max.toFixed(2)} <span className="text-slate-400">({t.configs} settings)</span>
              </span>
            </div>
          );
        })}
        <div className="grid grid-cols-[112px_1fr_150px] gap-3 text-[10px] text-slate-400">
          <span />
          <div className="relative h-3">
            {[-1, -0.5, 0, 0.5].map(v => (
              <span key={v} className="absolute -translate-x-1/2" style={{ left: `${pos(v)}%` }}>{v}</span>
            ))}
          </div>
          <span />
        </div>
      </div>
    </div>
  );
};

export const ModelComparisonReport: React.FC = () => {
  const winner = [...MODEL_ALGORITHMS].sort((a, b) => firstPlaces(b) - firstPlaces(a))[0];
  const accuracy = MODEL_COMPARISON.find(m => m.metric.startsWith('Accuracy'))!;
  const maeEvent = MODEL_COMPARISON.find(m => m.metric === 'MAE event total')!;

  const exportCsv = () => {
    const header = ['Metric', 'Better when', ...MODEL_ALGORITHMS];
    const rows = MODEL_COMPARISON.map(m => [m.metric, m.higherIsBetter ? 'higher' : 'lower', ...MODEL_ALGORITHMS.map(a => String(m.values[a]))]);
    rows.push(['Settings tried', '', ...MODEL_ALGORITHMS.map(a => String(MODEL_TUNING[a].configs))]);
    rows.push(['Best settings', '', ...MODEL_ALGORITHMS.map(a => MODEL_TUNING[a].bestParams)]);
    rows.push(['R² range over settings', '', ...MODEL_ALGORITHMS.map(a => `${MODEL_TUNING[a].r2Min} to ${MODEL_TUNING[a].r2Max}`)]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'NCF_Model_Comparison_Report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Title + actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Comparative Analysis of the Predictive Models</h2>
          <p className="text-xs text-slate-500">
            Random Forest, Gradient Boosting and Linear Regression trained on {TRAINING_DATASET.rows} budget line items from {TRAINING_DATASET.events} NCF events ({TRAINING_DATASET.years}),
            scored on events each model never saw.
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] text-[#0B3D2E] text-xs font-bold cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B3D2E] hover:bg-[#072A20] text-white text-xs font-bold cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print report
          </button>
        </div>
      </div>

      {/* Verdict */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#EEF4F0] border border-[#0B3D2E]/15">
        <Trophy className="w-5 h-5 text-[#0B3D2E] shrink-0 mt-0.5" />
        <p className="text-xs text-[#0B3D2E] leading-relaxed">
          <strong>{winner}</strong> ranked 1st on <strong>{firstPlaces(winner)} of {MODEL_COMPARISON.length}</strong> metrics and is the model the system uses.
          It reaches <strong>{accuracy.values[winner].toFixed(1)}%</strong> event accuracy with an average error of <strong>{peso(maeEvent.values[winner])}</strong> per event,
          and it is the most stable across settings.
        </p>
      </div>

      {/* One card per model */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MODEL_ALGORITHMS.map(a => {
          const t = MODEL_TUNING[a];
          const wins = firstPlaces(a);
          return (
            <div key={a} className={`bg-white rounded-2xl p-4 space-y-3 ${a === winner ? 'border-2 border-[#1A7F4E]' : 'border border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: MODEL_COLORS[a] }} aria-hidden="true" />
                  {a}
                </span>
                {a === winner
                  ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F2B705] text-[#0B3D2E]">Selected model</span>
                  : <span className="text-[10px] font-semibold text-slate-500">1st on {wins} of {MODEL_COMPARISON.length}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Event accuracy</span>
                  <p className="text-lg font-black text-slate-900">{accuracy.values[a].toFixed(1)}%</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Error per event</span>
                  <p className="text-lg font-black text-slate-900">{peso(maeEvent.values[a])}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">{t.howItLearns}</p>
              <p className="text-[11px] text-slate-500">
                Best of {t.configs} settings: <span className="font-mono text-slate-700">{t.bestParams}</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Legend for the charts below */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600" aria-label="Legend">
        {MODEL_ALGORITHMS.map(a => (
          <span key={a} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: MODEL_COLORS[a] }} aria-hidden="true" /> {a}
          </span>
        ))}
        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-[#B07A00] fill-[#F2B705]" /> best on that metric</span>
      </div>

      {/* Small multiples: one chart per metric, each on its own scale */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {MODEL_COMPARISON.map(m => <MetricChart key={m.metric} metric={m} />)}
      </div>

      <StabilityChart />

      {/* Table view of every number */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-[#EEF4F0] text-[#0B3D2E] text-xs font-bold">All results (table)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Metric</th>
                {MODEL_ALGORITHMS.map(a => <th key={a} className="py-2.5 px-4 text-right">{a}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MODEL_COMPARISON.map(m => (
                <tr key={m.metric}>
                  <td className="py-2 px-4 font-semibold text-slate-800">{m.metric}</td>
                  {MODEL_ALGORITHMS.map(a => (
                    <td key={a} className={`py-2 px-4 text-right font-mono ${rankOf(m, a) === 1 ? 'font-black text-[#0B3D2E]' : 'text-slate-600'}`}>
                      {fmt(m.metric, m.values[a], m.peso)}{rankOf(m, a) === 1 ? ' ★' : ''}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td className="py-2 px-4 font-semibold text-slate-800">Rank (1st places)</td>
                {MODEL_ALGORITHMS.map(a => (
                  <td key={a} className="py-2 px-4 text-right font-mono font-bold text-slate-800">{firstPlaces(a)} of {MODEL_COMPARISON.length}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Method: each algorithm was tuned with a hyperparameter grid and scored with repeated GroupKFold by event (5 folds × 3 repeats), so every score is for
        events the model never saw. The best setting of each algorithm is compared here. Source: TRAIN_MODEL/models/comparison_matrix.csv and tuning_log.csv.
      </p>
    </div>
  );
};

export default ModelComparisonReport;
