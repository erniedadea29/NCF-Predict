import React from 'react';
import { BudgetProposal } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { Printer, X, Download, CheckCircle, ShieldCheck } from 'lucide-react';

interface PrintableProposalModalProps {
  proposal: BudgetProposal | null;
  isOpen: boolean;
  onClose: () => void;
  // Students only ever see the fully-approved PDF with approver names
  // blacked out (Section 3) — everyone else sees real signatory names.
  redactSignatures?: boolean;
}

export const PrintableProposalModal: React.FC<PrintableProposalModalProps> = ({ proposal, isOpen, onClose, redactSignatures }) => {
  if (!isOpen || !proposal) return null;

  const handlePrint = () => {
    window.print();
  };

  // Renders a signatory's name either as normal text, or as a solid black
  // redaction box of roughly the same width (no e-signature/image system
  // exists to redact a real signature image, so this produces the same
  // visual effect from text data).
  const Signatory: React.FC<{ name: string }> = ({ name }) => (
    redactSignatures ? (
      <div className="bg-black h-4 mx-2 rounded-sm" aria-label="Redacted" />
    ) : (
      <p className="font-bold text-slate-900 border-b border-slate-400 pb-1 mx-2">{name}</p>
    )
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4">
        {/* Modal Controls Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">Official Budget Proposal Document</h3>
              <p className="text-xs text-slate-400">Printable & Signatory Layout • {proposal.school_year}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/20 text-slate-300 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-12 max-h-[80vh] overflow-y-auto font-serif text-slate-900 bg-white space-y-6">
          {/* Institutional Letterhead */}
          <div className="text-center border-b-2 border-emerald-800 pb-4 space-y-1">
            <div className="w-12 h-12 rounded-full bg-[#00873E] text-white font-black text-2xl flex items-center justify-center mx-auto mb-2 font-sans">
              Σ
            </div>
            <h1 className="text-xl font-bold uppercase tracking-widest text-emerald-950 font-sans">
              NAGA COLLEGE FOUNDATION
            </h1>
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-600 font-sans">
              Supreme Student Council • Student Activity Fund (SAF) Board
            </h2>
            <p className="text-[11px] text-slate-500 font-sans">
              M.T. Villanueva Ave., Naga City, Camarines Sur, Philippines
            </p>
          </div>

          {/* Document Title */}
          <div className="text-center space-y-1">
            <h3 className="text-lg font-extrabold uppercase text-slate-900 font-sans tracking-wide">
              ACTIVITY BUDGET PROPOSAL & FUND RELEASE REQUEST
            </h3>
            <p className="text-xs text-slate-600 font-sans">
              Academic Year: <span className="font-bold">{proposal.school_year}</span> • Status: <span className="font-bold text-emerald-700">{proposal.budget_status.replace(/_/g, ' ')}</span>
            </p>
          </div>

          {/* Proposal Summary Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs font-sans border border-slate-300 p-4 rounded-lg bg-slate-50/50">
            <div>
              <p className="text-slate-500">Project / Activity Title:</p>
              <p className="font-bold text-slate-900 text-sm">{proposal.budget_title}</p>
            </div>
            <div>
              <p className="text-slate-500">Department / Organization:</p>
              <p className="font-bold text-slate-900">{proposal.department} - {DEPARTMENTS[proposal.department]?.name}</p>
            </div>
            <div>
              <p className="text-slate-500">Proponent / Officer:</p>
              <p className="font-semibold text-slate-900">{proposal.created_by_officer}</p>
            </div>
            <div>
              <p className="text-slate-500">Total Requested Allocation:</p>
              <p className="font-extrabold text-emerald-800 text-base">
                ₱{proposal.total_budget_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            {proposal.event_title && (
              <div className="col-span-2">
                <p className="text-slate-500">Linked School Event:</p>
                <p className="font-semibold text-slate-900">{proposal.event_title}</p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-slate-500">Activity Rationale & Description:</p>
              <p className="text-slate-700 mt-0.5">{proposal.budget_description}</p>
            </div>
          </div>

          {/* Line Items Table (Price Evaluation & Requirements) */}
          <div className="space-y-2 font-sans">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              I. Itemized Requirements & Price Evaluation
            </h4>
            <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Item Requirement Description</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Unit Cost (₱)</th>
                    <th className="py-2 px-3 text-right">Estimated Amount (₱)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {proposal.line_items.map((item, i) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {item.item_desc}
                        {item.remarks && <p className="text-[10px] text-slate-500 font-normal italic">{item.remarks}</p>}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{item.category}</td>
                      <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono">₱{item.unit_cost.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">₱{item.estimated_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/50 font-bold text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={5} className="py-2.5 px-3 text-right uppercase text-[11px] text-emerald-900">
                      Grand Total Evaluated Budget:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-900 text-sm font-black">
                      ₱{proposal.total_budget_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Notes Section ("KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES") */}
          {proposal.notes && proposal.notes.length > 0 && (
            <div className="space-y-2 font-sans">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                II. Council Remarks & Official Notes ("KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES")
              </h4>
              <div className="space-y-1.5 border border-slate-200 rounded-lg p-3 bg-amber-50/30 text-xs">
                {proposal.notes.map((n) => (
                  <div key={n.id} className="pb-1 border-b border-amber-100 last:border-0 last:pb-0">
                    <span className="font-bold text-slate-900">{n.author_name} ({n.author_role}): </span>
                    <span className="text-slate-700">{n.note_content}</span>
                    <span className="text-[10px] text-slate-400 ml-2">({n.created_at})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signatory Blocks - 5-Stage Roles */}
          <div className="pt-6 font-sans space-y-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              III. Review, Resolution & Executive Approvals
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs text-center">
              {/* 1. Prepared by Treasurer */}
              <div className="border border-slate-200 p-3 rounded-lg flex flex-col justify-between h-28">
                <p className="text-[10px] text-slate-400 uppercase font-bold">1. Prepared / Drafted by:</p>
                <div>
                  <p className="font-bold text-slate-900 border-b border-slate-400 pb-1 mx-2">
                    {proposal.created_by_officer}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Council Treasurer</p>
                </div>
              </div>

              {/* 2. Endorsed by Governor — approver signatures redacted for students */}
              <div className="border border-slate-200 p-3 rounded-lg flex flex-col justify-between h-28">
                <p className="text-[10px] text-slate-400 uppercase font-bold">2. Executive Review:</p>
                <div>
                  <Signatory name={proposal.executive_review?.reviewed_by || 'Gov. Clarisse Mendoza'} />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {proposal.executive_review ? `Endorsed (${proposal.executive_review.date})` : 'Pending Review'}
                  </p>
                </div>
              </div>

              {/* 3. Council Resolution */}
              <div className="border border-slate-200 p-3 rounded-lg flex flex-col justify-between h-28">
                <p className="text-[10px] text-slate-400 uppercase font-bold">3. Council Resolution:</p>
                <div>
                  <Signatory name={proposal.council_resolution?.resolution_number || 'CSC-RES-2024-VOTING'} />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {proposal.votes.filter(v => v.vote === 'IN_FAVOR').length} Votes in Favor
                  </p>
                </div>
              </div>

              {/* 4. CSC Adviser Approval */}
              <div className="border border-slate-200 p-3 rounded-lg flex flex-col justify-between h-28">
                <p className="text-[10px] text-slate-400 uppercase font-bold">4. Recommended Approval:</p>
                <div>
                  <Signatory name={proposal.adviser_approval?.adviser_name || 'Prof. Ramon Villanueva, MBA'} />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {proposal.adviser_approval ? `Approved (${proposal.adviser_approval.date})` : 'CSC Adviser Approval'}
                  </p>
                </div>
              </div>

              {/* 5. Dean Final Approval & Fund Release */}
              <div className="border border-slate-200 p-3 rounded-lg flex flex-col justify-between h-28 sm:col-span-2">
                <p className="text-[10px] text-slate-400 uppercase font-bold">5. Final Approval & Fund Release Authorization:</p>
                <div>
                  <Signatory name={proposal.dean_approval?.dean_name || 'Dr. Evelyn Santos, DIT'} />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {proposal.dean_approval?.release_authorized
                      ? `Fund Release Approved & Released (${proposal.dean_approval.date})`
                      : 'College Dean / Executive Director'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
