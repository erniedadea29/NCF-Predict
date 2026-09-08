import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { useApp } from '../context/AppContext';
import {
  SAFRecord,
  DepartmentCode
} from '../types';
import { DEPARTMENTS } from '../data/mockData';
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  ShieldCheck,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';

interface SafCollectionAndStudentsProps {
  onOpenStudentModal?: () => void;
}

export const SafCollectionAndStudents: React.FC<SafCollectionAndStudentsProps> = () => {
  const {
    students,
    safRecords,
    scopedStudents,
    scopedSafRecords,
    userDepartment,
    isDepartmentRestricted,
    scopedDepartmentInfo,
    recordSafPayment,
    activeSemester,
    currentUser,
    clearances,
    generateClearance,
    isViewOnlyReviewer
  } = useApp();

  // Students land in the SAF ledger automatically the moment they register
  // under a course (create_student_with_saf runs during registration) —
  // there's no manual "Enroll Student" step here any more.
  const [activeSubTab, setActiveSubTab] = useState<'saf_ledger' | 'students_dir' | 'clearances'>('saf_ledger');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<DepartmentCode | 'ALL'>(() => isDepartmentRestricted ? userDepartment : 'ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');

  // Selected SAF record for payment modal — Cash-only (Section 9)
  const [payingSafRecord, setPayingSafRecord] = useState<SAFRecord | null>(null);
  const [paymentNotes, setPaymentNotes] = useState('');

  // Filter SAF Records
  const baseSaf = isDepartmentRestricted ? scopedSafRecords : safRecords;
  const filteredSaf = baseSaf.filter(rec => {
    if (!isDepartmentRestricted && deptFilter !== 'ALL' && rec.department !== deptFilter) return false;
    if (statusFilter === 'PAID' && !rec.paid) return false;
    if (statusFilter === 'UNPAID' && rec.paid) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = rec.student_name.toLowerCase().includes(q);
      const matchNum = rec.student_number.toLowerCase().includes(q);
      const matchCourse = rec.course.toLowerCase().includes(q);
      const matchSec = rec.section.toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchCourse && !matchSec) return false;
    }
    return true;
  });

  const totalSafPaid = baseSaf.filter(s => s.paid).reduce((sum, s) => sum + s.amount, 0);
  const totalSafExpected = baseSaf.reduce((sum, s) => sum + s.amount, 0);
  const collectionPercentage = totalSafExpected > 0 ? Math.round((totalSafPaid / totalSafExpected) * 100) : 0;
  const displayStudents = isDepartmentRestricted ? scopedStudents : students;

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSafRecord) return;
    recordSafPayment(payingSafRecord.id, 'Cash', paymentNotes);
    setPayingSafRecord(null);
    setPaymentNotes('');
  };

  const handleGenerateClearance = async (studentId: string) => {
    setGeneratingFor(studentId);
    await generateClearance(studentId);
    setGeneratingFor(null);
  };

  // Official SAF receipt as a real PDF (was a plain-text .txt download).
  // Works regardless of whether an auto-generated copy already exists in
  // Storage from Cash-In (see AppContext.buildSafReceiptPdf) — this always
  // produces one on the spot from the record's own data.
  const printOfficialReceipt = (rec: SAFRecord) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let y = 60;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('NAGA COLLEGE FOUNDATION (NCF)', centerX, y, { align: 'center' });
    y += 18;
    doc.setFontSize(11);
    doc.text('Supreme Student Council — Student Activity Fund (SAF)', centerX, y, { align: 'center' });
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Official Cash Receipt', centerX, y, { align: 'center' });
    y += 20;
    doc.setDrawColor(0, 135, 62);
    doc.setLineWidth(1.5);
    doc.line(60, y, pageWidth - 60, y);
    y += 30;

    const row = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(label, 70, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 260, y);
      y += 22;
    };

    row('Receipt No.:', rec.receipt_no || 'PENDING');
    row('Date Issued:', rec.payment_date || new Date().toLocaleString());
    row('School Year:', `${rec.school_year} • ${activeSemester.semester_name}`);
    row('Student Name:', rec.student_name);
    row('Student Number:', rec.student_number);
    row('Course / Section:', `${rec.course} - ${rec.section} (${rec.year_level})`);
    row('Department:', `${rec.department} (${DEPARTMENTS[rec.department]?.name || ''})`);
    row('Payment Method:', rec.payment_method || 'Cash');
    row('Reference No.:', rec.double_entry.reference_no);

    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(60, y, pageWidth - 60, y);
    y += 30;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CREDIT: Cash on Hand', 70, y);
    doc.setFontSize(16);
    doc.text(`Amount Paid: PHP ${rec.amount.toFixed(2)}`, 70, y + 24);
    y += 60;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('This receipt certifies that the above Student Activity Fund (SAF) payment has been', 70, y);
    y += 14;
    doc.text('received, validated for examination clearance, and recorded in the NCF Predict', 70, y);
    y += 14;
    doc.text('treasury ledger.', 70, y);
    y += 30;
    doc.text(`Collected by: ${rec.collected_by}`, 70, y);
    y += 14;
    doc.text(`Notes: ${rec.notes || 'Enrollment SAF clearance granted'}`, 70, y);
    y += 20;
    doc.text('Thank you for supporting student council activities & projects.', 70, y);

    doc.save(`NCF_SAF_Receipt_${rec.student_number}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Summary Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Record of Collection of Student Activity Fund (SAF)
          </h2>
          <p className="text-xs text-slate-500">
            <span className="font-bold text-slate-800">CREDIT: Cash on Hand</span> ({activeSemester.school_year_label})
          </p>
        </div>
      </div>

      {/* SAF Double Entry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total SAF Collected</span>
          <p className="text-xl sm:text-2xl font-black text-emerald-700">
            ₱{totalSafPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500 block">Double-entry credited to treasury</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Collection Rate</span>
          <p className="text-xl sm:text-2xl font-black text-slate-900">{collectionPercentage}%</p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#00873E]" style={{ width: `${collectionPercentage}%` }} />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Paid Students</span>
          <p className="text-xl sm:text-2xl font-black text-emerald-600">
            {safRecords.filter(s => s.paid).length} <span className="text-xs font-normal text-slate-500">/ {safRecords.length}</span>
          </p>
          <span className="text-[10px] text-emerald-600 font-semibold">Cleared for exam</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Uncollected Receivables</span>
          <p className="text-xl sm:text-2xl font-black text-amber-600">
            ₱{(totalSafExpected - totalSafPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-amber-600 font-semibold">
            {safRecords.filter(s => !s.paid).length} Pending Students
          </span>
        </div>
      </div>

      {/* Sub Tabs: Ledger vs Student Directory vs SAF Clearance */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1 shadow-2xs">
        <button
          onClick={() => setActiveSubTab('saf_ledger')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'saf_ledger' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Ledger ({filteredSaf.length})
        </button>

        <button
          onClick={() => setActiveSubTab('students_dir')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'students_dir' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Student Directory ({displayStudents.length})
        </button>

        <button
          onClick={() => setActiveSubTab('clearances')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'clearances' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          SAF Clearance
        </button>
      </div>

      {/* TAB 1: SAF LEDGER */}
      {activeSubTab === 'saf_ledger' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Student #, Name, Course, Section..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 focus:outline-emerald-500 font-medium"
              />
            </div>

            {isDepartmentRestricted ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Dept: {userDepartment} - {scopedDepartmentInfo.name}
                <span className="text-[10px] bg-blue-200/80 text-blue-950 px-1.5 py-0.2 rounded font-black ml-1">LOCKED</span>
              </div>
            ) : (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-700"
              >
                <option value="ALL">All Departments</option>
                {Object.keys(DEPARTMENTS).map(code => (
                  <option key={code} value={code}>{code} - {DEPARTMENTS[code as DepartmentCode].name}</option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-700"
            >
              <option value="ALL">All Status (Paid & Pending)</option>
              <option value="PAID">Paid Only (Cleared)</option>
              <option value="UNPAID">Unpaid Only (Pending)</option>
            </select>
          </div>

          {/* SAF Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Student Info</th>
                    <th className="py-3 px-4">Course & Section</th>
                    <th className="py-3 px-4">Dept</th>
                    <th className="py-3 px-4 text-right">SAF Fee</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Double-Entry Reference</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSaf.map((rec) => {
                    const dept = DEPARTMENTS[rec.department];
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{rec.student_name}</p>
                          <p className="text-[11px] font-mono text-slate-500">{rec.student_number}</p>
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-800">{rec.course}</p>
                          <p className="text-[11px] text-slate-500">{rec.section} • {rec.year_level}</p>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${dept?.badgeBg}`}>
                            {rec.department}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₱{rec.amount.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {rec.paid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Unpaid
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-mono text-[11px] text-slate-800 font-semibold">
                            {rec.double_entry.reference_no}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                            {rec.paid ? `CR: ${rec.double_entry.credit_account}` : 'DR: SAF Receivable'}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {rec.paid ? (
                            <button
                              onClick={() => printOfficialReceipt(rec)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                              title="Download Official SAF Receipt"
                            >
                              <Printer className="w-3.5 h-3.5 inline mr-1" />
                              Receipt
                            </button>
                          ) : isViewOnlyReviewer ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold">Unpaid</span>
                          ) : (
                            <button
                              onClick={() => setPayingSafRecord(rec)}
                              className="px-3 py-1 rounded-lg bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                            >
                              Cash-In
                            </button>
                          )}
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

      {/* TAB 2: STUDENTS DIRECTORY */}
      {activeSubTab === 'students_dir' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Student Directory</h3>
                {isDepartmentRestricted && (
                  <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded">
                    {userDepartment} ONLY
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">School ID, Course, Section, and S/Y Information</p>
            </div>
          </div>

          {displayStudents.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
              <p className="text-xs text-slate-500 font-medium">No students registered yet under {userDepartment}.</p>
              <p className="text-[11px] text-slate-400">Students appear here automatically once they register for a course in this department.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {displayStudents.map((stud) => (
                <div
                  key={stud.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 bg-slate-50/50 hover:bg-white transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${DEPARTMENTS[stud.department]?.badgeBg}`}>
                      {stud.department}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800">{stud.student_number}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{stud.first_name} {stud.last_name}</h4>
                    <p className="text-xs text-slate-600">{stud.course}</p>
                    <p className="text-[11px] text-slate-400">{stud.section} • {stud.year_level}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400">{stud.school_year}</span>
                    <span className="text-slate-400 text-[10px] font-mono">{stud.email}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SAF CLEARANCE */}
      {activeSubTab === 'clearances' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">SAF Clearance Status</h3>
            <p className="text-xs text-slate-500">
              Cleared = SAF fully paid AND no unpaid event penalties. This is the same record a future graduation/enrollment
              clearance check would read from.
            </p>
          </div>

          {displayStudents.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-500 font-medium">No students to clear yet.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Clearance Code</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayStudents.map(stud => {
                    const record = clearances.find(c => c.student_id === stud.id);
                    return (
                      <tr key={stud.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900">{stud.first_name} {stud.last_name}</p>
                          <p className="text-[11px] font-mono text-slate-500">{stud.student_number}</p>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {record?.clearance_code || 'Not generated yet'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {!record ? (
                            <span className="text-[10px] text-slate-400">—</span>
                          ) : record.status === 'CLEARED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <ShieldCheck className="w-3 h-3" /> Cleared
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <ShieldAlert className="w-3 h-3" /> Hold ({record.unpaid_penalties_count} unpaid)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isViewOnlyReviewer ? (
                            <span className="text-[10px] text-slate-400">View-only</span>
                          ) : (
                            <button
                              onClick={() => handleGenerateClearance(stud.id)}
                              disabled={generatingFor === stud.id}
                              className="flex items-center gap-1 ml-auto px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${generatingFor === stud.id ? 'animate-spin' : ''}`} />
                              {record ? 'Refresh' : 'Generate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CASH-IN PAYMENT MODAL */}
      {payingSafRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#00873E] text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">Record SAF Cash-In Payment</h3>
                <p className="text-xs text-emerald-100">Debit SAF, Credit Cash Double Entry</p>
              </div>
              <button onClick={() => setPayingSafRecord(null)} className="text-white hover:opacity-80">✕</button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900">{payingSafRecord.student_name}</p>
                <p className="text-slate-500">{payingSafRecord.student_number} • {payingSafRecord.course} ({payingSafRecord.section})</p>
                <p className="text-emerald-700 font-extrabold text-base pt-1">
                  SAF Amount: ₱{payingSafRecord.amount.toFixed(2)}
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Payment Method</label>
                <div className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 text-white text-center">
                  Cash
                </div>
                <p className="text-[10px] text-slate-400">SAF payments are collected on a cash basis only.</p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Paid at Treasury window counter 1"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] font-mono text-emerald-900 space-y-0.5">
                <p><strong>CREDIT:</strong> Cash on Hand (Treasury)</p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#00873E] hover:bg-[#007033] text-white font-bold rounded-2xl shadow-md transition cursor-pointer"
              >
                Confirm Payment & Issue Official Receipt
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
