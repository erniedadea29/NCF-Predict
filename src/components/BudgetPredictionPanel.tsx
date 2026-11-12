import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BudgetProposal } from '../types';
import { Cpu, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

/**
 * The trained Random Forest's estimate for one budget request: what its items
 * cost at past NCF events vs what's being requested, with items flagged when
 * they're more than 25% above or below the estimate.
 */
export const BudgetPredictionPanel: React.FC<{ proposal: BudgetProposal }> = ({ proposal }) => {
  const { requestPredictions, runBudgetPrediction, isReadOnlyStudent } = useApp();
  const prediction = requestPredictions[proposal.id];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    setBusy(true);
    setError(null);
    const res = await runBudgetPrediction(proposal.id);
    setBusy(false);
    if (!res.success) setError(res.message);
  };

  const flagged = prediction?.items.filter(i => i.flag !== 'OK') ?? [];
  const overall = prediction ? (prediction.variance_pct > 25 ? 'OVER' : prediction.variance_pct < -25 ? 'UNDER' : 'OK') : null;

  return (
    <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/40 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-purple-900 flex items-center gap-1.5">
          <Cpu className="w-4 h-4 text-purple-600" /> Random Forest Cost Estimate
        </span>
        {!isReadOnlyStudent && proposal.line_items.length > 0 && (
          <button
            onClick={handlePredict}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white text-[11px] font-bold cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
            {prediction ? 'Re-predict' : 'Predict'}
          </button>
        )}
      </div>

      {!prediction ? (
        <p className="text-slate-500">
          {busy ? 'Estimating each item with the trained model...' : 'No estimate yet for this request.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-slate-200 p-2.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">Requested</span>
              <p className="font-black text-slate-900">{peso(prediction.requested_total)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-2.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">Model Estimate</span>
              <p className="font-black text-purple-700">{peso(prediction.predicted_total)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-2.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">Difference</span>
              <p className={`font-black ${overall === 'OK' ? 'text-emerald-700' : 'text-rose-600'}`}>{pct(prediction.variance_pct)}</p>
            </div>
          </div>

          <p className={`flex items-start gap-1.5 font-semibold ${overall === 'OK' ? 'text-emerald-800' : 'text-amber-800'}`}>
            {overall === 'OK' ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
            {overall === 'OK'
              ? 'The total is within 25% of what similar items cost at past NCF events.'
              : overall === 'OVER'
              ? 'The total is more than 25% ABOVE what similar items cost at past NCF events. Review the flagged items.'
              : 'The total is more than 25% BELOW what similar items cost at past NCF events. Check that nothing is missing or underpriced.'}
          </p>

          {flagged.length > 0 && (
            <ul className="space-y-1">
              {flagged.map((it, i) => (
                <li key={it.request_item_id || i} className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 px-2.5 py-1.5">
                  <span className="font-semibold text-slate-800 truncate">
                    {it.item}
                    {it.low_confidence && <span className="ml-1 text-amber-700" title="Category not in training data: less reliable">⚠</span>}
                  </span>
                  <span className="shrink-0 font-mono">
                    {peso(it.requested_amount)} vs {peso(it.pred_subtotal)}{' '}
                    <span className={`font-bold ${it.flag === 'OVER' ? 'text-rose-600' : 'text-amber-700'}`}>({pct(it.variance_pct)})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {prediction.has_low_confidence_items && (
            <p className="text-[11px] text-amber-700">⚠ Some items use a category the model wasn't trained on, so their estimates are less reliable.</p>
          )}
          <p className="text-[10px] text-slate-400">
            A flag is a prompt to review, not an automatic rejection • predicted {new Date(prediction.predicted_at).toLocaleString('en-US')}
          </p>
        </>
      )}

      {error && <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">{error}</p>}
    </div>
  );
};
