import React from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import {
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  GraduationCap,
  Eye
} from 'lucide-react';

export const StudentDashboardView: React.FC = () => {
  const {
    students,
    safRecords,
    attendances,
    activeSemester,
    currentUser,
    generateClearance
  } = useApp();

  const [clearanceError, setClearanceError] = React.useState('');
  const [generatingClearance, setGeneratingClearance] = React.useState(false);

  // Always resolve strictly to the logged-in student's own record — students
  // can only ever view their own data, never anyone else's.
  const activeStudent = students.find(s => s.student_number === currentUser.student_number);

  // Student SAF Record
  const studentSaf = safRecords.find(s => s.student_number === activeStudent?.student_number);

  // Student Penalties & Attendance (own records only)
  const studentPenalties = (attendances || []).filter(
    p => p.student_number === activeStudent?.student_number
  );
  const unpaidPenalties = studentPenalties.filter(p => (p.penalty_amount > 0 || (p.amount || 0) > 0) && !p.penalty_paid);
  const totalUnpaidPenalty = unpaidPenalties.reduce((sum, p) => sum + (p.penalty_amount ?? p.amount ?? 0), 0);

  const isClearedForExam = studentSaf?.paid && totalUnpaidPenalty === 0;

  const printClearanceSlip = async () => {
    if (!activeStudent) return;
    setClearanceError('');
    setGeneratingClearance(true);
    // Generates (or refreshes) a real, stored clearance record first — the
    // printed slip below is no longer purely client-side; it reflects an
    // actual row cashier/adviser/dean/admin can also see, with a real code.
    const record = await generateClearance(activeStudent.id);
    setGeneratingClearance(false);
    if (!record) {
      setClearanceError('Could not generate your clearance record right now. Please try again.');
      return;
    }

    const slip = `
============================================================
             NAGA COLLEGE FOUNDATION (NCF)
          OFFICIAL STUDENT CLEARANCE CERTIFICATE
============================================================
Clearance Code: ${record.clearance_code}
Academic Year: ${activeSemester.school_year_label} • ${activeSemester.semester_name}
Date Generated: ${new Date(record.generated_at).toLocaleString()}
------------------------------------------------------------
Student ID   : ${activeStudent?.student_number}
Student Name : ${activeStudent?.first_name} ${activeStudent?.last_name}
Department   : ${activeStudent?.department} - ${DEPARTMENTS[activeStudent?.department || 'CCS']?.name}
Course & Yr  : ${activeStudent?.course} (${activeStudent?.year_level})
Section      : ${activeStudent?.section}
------------------------------------------------------------
CLEARANCE STATUS BREAKDOWN:
1. Student Activity Fund (SAF): ${record.saf_paid ? `CLEARED / PAID (₱${(studentSaf?.amount ?? 500).toFixed(2)})` : `UNPAID (₱${(studentSaf?.amount ?? 500).toFixed(2)})`}
   Receipt Code: ${studentSaf?.receipt_no || 'N/A'}
   Reference: ${studentSaf?.double_entry.reference_no || 'N/A'}

2. Event Attendance & Fines  : ${record.unpaid_penalties_count === 0 ? 'CLEARED (₱0.00 Outstanding)' : `UNPAID FINES (₱${record.unpaid_penalties_amount.toFixed(2)}, ${record.unpaid_penalties_count} record(s))`}

------------------------------------------------------------
FINAL EXAMINATION CLEARANCE:
${record.status === 'CLEARED' ? '>>> [ OFFICIALLY CLEARED & VALIDATED ] <<<' : '>>> [ HOLD - SETTLE UNPAID DUES AT TREASURY ] <<<'}
============================================================
Validated by Naga College Foundation Supreme Student Council
Verify this clearance code with the Treasury/Adviser office if needed.
`;

    const blob = new Blob([slip], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NCF_Clearance_${activeStudent?.student_number}_${record.clearance_code}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!activeStudent) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
        <p className="text-slate-600 font-semibold">No linked student record found for your account yet.</p>
        <p className="text-xs text-slate-500">Please contact your department treasurer to have your student record enrolled.</p>
      </div>
    );
  }

  const deptInfo = DEPARTMENTS[activeStudent.department];

  return (
    <div className="space-y-6">
      {/* View-only notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs text-blue-900">
        <Eye className="w-4 h-4 text-blue-600 shrink-0" />
        <span>Student accounts have <strong>view-only</strong> access. To update information or settle fines, please visit your SSC Treasury / Adviser.</span>
      </div>

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-emerald-600" />
          My Student Portal & SAF Clearance
        </h2>
        <p className="text-xs text-slate-500">
          Your SAF Fee, Event Attendance, & Academic Clearance status ({activeSemester.school_year_label})
        </p>
      </div>

      {/* Main Student Profile Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 font-black text-xl flex items-center justify-center border-2 border-emerald-300">
              {activeStudent.first_name[0]}{activeStudent.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900">
                  {activeStudent.first_name} {activeStudent.last_name}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${deptInfo?.badgeBg}`}>
                  {activeStudent.department}
                </span>
              </div>
              <p className="text-xs font-mono font-semibold text-slate-500 mt-0.5">
                Student ID: <span className="text-slate-800 font-bold">{activeStudent.student_number}</span>
              </p>
            </div>
          </div>

          {/* Clearance Status Badge */}
          <div className="flex items-center gap-2">
            {isClearedForExam ? (
              <div className="px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold text-emerald-700">Exam Clearance</p>
                  <p className="text-xs font-black">OFFICIALLY CLEARED</p>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 bg-amber-100 text-amber-900 border border-amber-300 rounded-2xl flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold text-amber-700">Exam Clearance</p>
                  <p className="text-xs font-black">HOLD (Unpaid Dues)</p>
                </div>
              </div>
            )}

            <button
              onClick={printClearanceSlip}
              disabled={generatingClearance}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl border border-slate-200 transition cursor-pointer disabled:opacity-50"
              title="Generate & Print Official Clearance Slip"
            >
              <Printer className={`w-4 h-4 ${generatingClearance ? 'animate-pulse' : ''}`} />
            </button>
          </div>
          {clearanceError && (
            <p className="text-[11px] text-rose-600 font-semibold mt-2">{clearanceError}</p>
          )}
        </div>

        {/* Academic Details (read-only) */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Enrolled Academic Program Info
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Course / Degree</p>
              <p className="text-xs font-extrabold text-slate-800 mt-0.5">{activeStudent.course}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Year & Section</p>
              <p className="text-xs font-extrabold text-slate-800 mt-0.5">{activeStudent.year_level} • {activeStudent.section}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase">College Department</p>
              <p className="text-xs font-extrabold text-slate-800 mt-0.5">{deptInfo?.name}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Active Semester</p>
              <p className="text-xs font-extrabold text-slate-800 mt-0.5">{activeSemester.school_year_label}</p>
            </div>
          </div>
        </div>

        {/* Section 1: SAF Fee Status Card */}
        <div className="p-5 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 rounded-2xl border border-emerald-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-700" />
              <h4 className="font-extrabold text-sm text-emerald-950">
                Student Activity Fund (SAF) Record
              </h4>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-800">
              Fee: ₱{studentSaf?.amount.toFixed(2) || '500.00'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Payment Status</span>
              <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                {studentSaf?.paid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">PAID & SETTLED</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-700">UNPAID (Pending)</span>
                  </>
                )}
              </p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Receipt / Voucher #</span>
              <p className="font-mono font-bold text-slate-800">
                {studentSaf?.receipt_no || 'N/A (Awaiting Payment)'}
              </p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Double-Entry Vault Ref</span>
              <p className="font-mono text-[11px] font-semibold text-slate-600">
                {studentSaf?.double_entry.reference_no || 'DE-SAF-2024'}
              </p>
            </div>
          </div>
          {!studentSaf?.paid && (
            <p className="text-[11px] text-emerald-800/80">Please settle your SAF fee at the SSC Treasury Office to update this status.</p>
          )}
        </div>

        {/* Section 2: Penalties & Event Fines (view-only) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              My Event Attendance Penalties & Fines ({studentPenalties.length})
            </h4>
            <span className="text-xs font-extrabold text-rose-700">
              Outstanding: ₱{totalUnpaidPenalty.toFixed(2)}
            </span>
          </div>

          {studentPenalties.length === 0 ? (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center text-xs text-emerald-800 font-semibold">
              🎉 Perfect Attendance! No penalties or fines recorded for this semester.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Event Name</th>
                    <th className="py-2.5 px-3">Reason / Session</th>
                    <th className="py-2.5 px-3 text-right">Penalty Fee (₱)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentPenalties.map((pen) => {
                    const fineAmount = pen.penalty_amount ?? pen.amount ?? 0;
                    const isFinePaid = pen.penalty_paid;
                    const hasFine = fineAmount > 0;
                    return (
                      <tr key={pen.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{pen.event_title}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {pen.notes || pen.reason || (pen.status === 'Absent' ? 'Unexcused Absence' : 'Attended')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {hasFine ? `₱${fineAmount.toFixed(2)}` : '₱0.00'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {!hasFine ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-full text-[10px]">No Fine</span>
                          ) : isFinePaid ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">PAID</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-full text-[10px]">UNPAID</span>
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
      </div>
    </div>
  );
};
