import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DepartmentCode, SchoolEvent, EventAttendance } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { 
  Calendar, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  UserX, 
  MapPin, 
  Clock, 
  Search,
  Filter,
  Receipt,
  Users,
  ShieldCheck,
  Award,
  Sparkles,
  TrendingUp
} from 'lucide-react';

export const EventsAndPenalties: React.FC = () => {
  const { 
    events, 
    attendances,
    scopedEvents,
    scopedAttendances,
    students, 
    scopedStudents,
    userDepartment,
    isDepartmentRestricted,
    scopedDepartmentInfo,
    activeSemester, 
    addEvent, 
    recordAttendance, 
    payPenalty,
    isReadOnlyStudent,
    currentUser
  } = useApp();

  const [activeTab, setActiveTab] = useState<'events' | 'penalties' | 'create_event'>('events');
  const [selectedEventForAttendance, setSelectedEventForAttendance] = useState<SchoolEvent | null>(null);

  // New Event Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('2024-10-18');
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('16:30');
  const [eventVenue, setEventVenue] = useState('NCF Gymnasium');
  const [eventType, setEventType] = useState<'Academic' | 'Event' | 'Capital' | 'Operations' | 'Revenue' | 'Institutional'>('Academic');
  const [eventDept, setEventDept] = useState<DepartmentCode>(userDepartment);
  const [penaltyAmount, setPenaltyAmount] = useState('50.00');

  // Search & Filter in Events
  const [eventSearch, setEventSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');

  // Search & Filter in Penalties
  const [penaltySearch, setPenaltySearch] = useState('');
  const [penaltyStatusFilter, setPenaltyStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID' | 'ABSENT' | 'PRESENT'>('ALL');

  // Settlement feedback
  const [settledReceipt, setSettledReceipt] = useState<{ studentName: string; receiptNo: string; amount: number } | null>(null);
  const [attendanceSearch, setAttendanceSearch] = useState('');

  const displayEvents = isDepartmentRestricted ? scopedEvents : events;
  const displayAttendances = isReadOnlyStudent
    ? attendances.filter(a => a.student_number === currentUser.student_number)
    : (isDepartmentRestricted ? scopedAttendances : attendances);
  const displayStudents = isDepartmentRestricted ? scopedStudents : students;

  // Key KPI metrics
  const totalEventsCount = displayEvents.length;
  const unpaidPenalties = displayAttendances.filter(a => a.penalty_amount > 0 && !a.penalty_paid);
  const totalUnpaidFines = unpaidPenalties.reduce((sum, a) => sum + a.penalty_amount, 0);
  const paidPenalties = displayAttendances.filter(a => a.penalty_amount > 0 && a.penalty_paid);
  const totalCollectedFines = paidPenalties.reduce((sum, a) => sum + a.penalty_amount, 0);
  const presentRecords = displayAttendances.filter(a => a.status === 'Present');
  const complianceRate = displayAttendances.length > 0 
    ? Math.round((presentRecords.length / displayAttendances.length) * 100) 
    : 100;

  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      alert('Please enter an event title.');
      return;
    }

    const penaltyVal = parseFloat(penaltyAmount) || 50.0;
    const targetDept = isDepartmentRestricted ? userDepartment : eventDept;

    addEvent({
      event_title: eventTitle.trim(),
      event_description: eventDesc.trim() || 'Mandatory departmental academic assembly.',
      description: eventDesc.trim() || 'Mandatory departmental academic assembly.',
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      venue: eventVenue.trim() || 'NCF Campus',
      event_type: eventType,
      department: targetDept,
      penalty: penaltyVal,
      penalty_fee_amount: penaltyVal,
      activesem_id: activeSemester.id,
      school_year: activeSemester.school_year_label
    });

    setEventTitle('');
    setEventDesc('');
    setActiveTab('events');
  };

  const handleSettlePenalty = (attendanceId: string, studentName: string, amount: number) => {
    const receiptNo = `PEN-${userDepartment}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    payPenalty(attendanceId, receiptNo);
    setSettledReceipt({ studentName, receiptNo, amount });
    setTimeout(() => setSettledReceipt(null), 5000);
  };

  const filteredEvents = displayEvents.filter(ev => {
    if (eventTypeFilter !== 'ALL' && ev.event_type !== eventTypeFilter) return false;
    if (eventSearch.trim() !== '') {
      const q = eventSearch.toLowerCase();
      const titleMatch = ev.event_title.toLowerCase().includes(q);
      const venueMatch = ev.venue.toLowerCase().includes(q);
      const descMatch = (ev.event_description || ev.description || '').toLowerCase().includes(q);
      return titleMatch || venueMatch || descMatch;
    }
    return true;
  });

  const filteredAttendances = displayAttendances.filter(att => {
    if (penaltyStatusFilter === 'UNPAID') {
      if (!(att.penalty_amount > 0 && !att.penalty_paid)) return false;
    } else if (penaltyStatusFilter === 'PAID') {
      if (!(att.penalty_amount > 0 && att.penalty_paid)) return false;
    } else if (penaltyStatusFilter === 'ABSENT') {
      if (att.status !== 'Absent') return false;
    } else if (penaltyStatusFilter === 'PRESENT') {
      if (att.status !== 'Present') return false;
    }

    if (penaltySearch.trim() !== '') {
      const q = penaltySearch.toLowerCase();
      return (
        att.student_name.toLowerCase().includes(q) ||
        att.student_number.toLowerCase().includes(q) ||
        att.event_title.toLowerCase().includes(q) ||
        att.course.toLowerCase().includes(q) ||
        (att.notes || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Events & Absence Penalties Manager
                {isDepartmentRestricted && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-bold">
                    {userDepartment} College
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Semester activity schedule, student roll call attendance, and clearance penalty enforcement ({activeSemester.school_year_label})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isReadOnlyStudent && (
            <button
              onClick={() => setActiveTab('create_event')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create {isDepartmentRestricted ? userDepartment : 'Semester'} Event</span>
            </button>
          )}
        </div>
      </div>

      {/* Settlement Success Notification */}
      {settledReceipt && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <p className="font-bold text-xs">
                Penalty Fine Cleared for {settledReceipt.studentName}!
              </p>
              <p className="text-[11px] text-emerald-700">
                Official Treasury Receipt <strong>{settledReceipt.receiptNo}</strong> • Amount: ₱{settledReceipt.amount.toFixed(2)} credited to double-entry journal.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setSettledReceipt(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Scheduled Events</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalEventsCount}</p>
          <p className="text-[11px] text-slate-500 font-medium">{activeSemester.semester_name}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Attendance Rate</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{complianceRate}%</p>
          <p className="text-[11px] text-slate-500 font-medium">{presentRecords.length} Present across sessions</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Unpaid Fines</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600">₱{totalUnpaidFines.toFixed(2)}</p>
          <p className="text-[11px] text-rose-700 font-medium">{unpaidPenalties.length} students with pending dues</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Fines Collected</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">₱{totalCollectedFines.toFixed(2)}</p>
          <p className="text-[11px] text-emerald-800 font-medium">{paidPenalties.length} fines settled at Treasury</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-2xs">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'events' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{isDepartmentRestricted ? `${userDepartment} Events` : 'All Semester Events'} ({displayEvents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('penalties')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'penalties' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{isReadOnlyStudent ? 'My Penalty Fines' : 'Attendance & Penalty Fines'} ({displayAttendances.length})</span>
          {unpaidPenalties.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'penalties' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800'
            }`}>
              {unpaidPenalties.length} Unpaid
            </span>
          )}
        </button>
        {!isReadOnlyStudent && (
          <button
            onClick={() => setActiveTab('create_event')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'create_event' ? 'bg-[#00873E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>+ New Event</span>
          </button>
        )}
      </div>

      {/* TAB 1: SEMESTER EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search events by title, venue, or description..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-700"
              >
                <option value="ALL">All Event Categories</option>
                <option value="Academic">Academic</option>
                <option value="Event">Event / Summit</option>
                <option value="Institutional">Institutional</option>
                <option value="Revenue">Revenue / Trade</option>
                <option value="Operations">Operations</option>
                <option value="Capital">Capital</option>
              </select>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Calendar className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-base">No events found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {eventSearch || eventTypeFilter !== 'ALL'
                    ? 'Try adjusting your search query or filter.'
                    : `No events currently scheduled for ${isDepartmentRestricted ? scopedDepartmentInfo.name : 'the semester'}.`}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('create_event')}
                className="px-4 py-2 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                + Create {isDepartmentRestricted ? userDepartment : 'New'} Event
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((ev) => {
                const isAll = ev.department === 'ALL';
                const dept = !isAll ? DEPARTMENTS[ev.department as DepartmentCode] : null;
                const penaltyVal = ev.penalty ?? ev.penalty_fee_amount ?? 50.0;
                const desc = ev.event_description || ev.description || 'Mandatory departmental academic activity.';
                const eventAtts = displayAttendances.filter(a => a.event_id === ev.id);
                const presentCount = eventAtts.filter(a => a.status === 'Present').length;
                const absentCount = eventAtts.filter(a => a.status === 'Absent').length;

                return (
                  <div
                    key={ev.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black border ${
                          isAll 
                            ? 'bg-amber-100 border-amber-300 text-amber-900' 
                            : (dept?.badgeBg || 'bg-slate-100 border-slate-300 text-slate-900')
                        }`}>
                          {isAll ? 'ALL COLLEGES' : ev.department}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                          {ev.event_date}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 leading-snug line-clamp-2">
                          {ev.event_title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {desc}
                        </p>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{ev.venue}</span>
                        </div>
                        {ev.start_time && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{ev.start_time} - {ev.end_time || '17:00'}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>
                            Absence Fine: <strong className="text-slate-900">₱{penaltyVal.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Attendance Quick Stats */}
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 pt-1">
                        <span>Attendance Status:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-700 font-bold">✓ {presentCount} Present</span>
                          <span className="text-rose-700 font-bold">✗ {absentCount} Absent</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {ev.school_year || activeSemester.school_year_label}
                      </span>
                      {!isReadOnlyStudent && (
                        <button
                          onClick={() => setSelectedEventForAttendance(ev)}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Take Attendance</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENALTIES & ATTENDANCE ROSTER */}
      {activeTab === 'penalties' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by student number, student name, course, or event..."
                value={penaltySearch}
                onChange={(e) => setPenaltySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 font-medium"
              />
            </div>
            <select
              value={penaltyStatusFilter}
              onChange={(e) => setPenaltyStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-700"
            >
              <option value="ALL">All Records ({displayAttendances.length})</option>
              <option value="UNPAID">Unpaid Penalties Only ({unpaidPenalties.length})</option>
              <option value="PAID">Paid / Settled Fines ({paidPenalties.length})</option>
              <option value="ABSENT">All Absences</option>
              <option value="PRESENT">Present Students</option>
            </select>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Event Title</th>
                    <th className="py-3 px-4 text-center">Attendance</th>
                    <th className="py-3 px-4">Remarks / Absence Reason</th>
                    <th className="py-3 px-4 text-right">Penalty Fine (₱)</th>
                    <th className="py-3 px-4 text-center">Clearance Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                        <AlertTriangle className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="font-bold text-sm text-slate-700">No attendance or penalty records match your query.</p>
                        <p className="text-xs text-slate-400">All registered students currently have cleared status or no attendances logged yet.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAttendances.map((att) => {
                      const amount = att.penalty_amount ?? att.amount ?? 0;
                      const hasPenalty = amount > 0;
                      const isPaid = att.penalty_paid;

                      return (
                        <tr key={att.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">{att.student_name}</p>
                            <p className="text-[11px] font-mono text-slate-500">{att.student_number} • {att.course} ({att.section})</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-800">{att.event_title}</p>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {att.department}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {att.status === 'Present' ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Present {att.time_in ? `(${att.time_in})` : ''}
                              </span>
                            ) : att.status === 'Excused' ? (
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-bold rounded-lg text-[10px]">
                                Excused
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-lg text-[10px] inline-flex items-center gap-1">
                                <UserX className="w-3 h-3" />
                                Absent
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                            {att.notes || (att.status === 'Absent' ? 'Unexcused Absence' : 'On-time attendance verified')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            {hasPenalty ? `₱${amount.toFixed(2)}` : '₱0.00'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {!hasPenalty ? (
                              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-full text-[10px]">
                                No Fine
                              </span>
                            ) : isPaid ? (
                              <div className="flex flex-col items-center">
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-full text-[10px]">
                                  CLEARED / PAID
                                </span>
                                {att.receipt_no && (
                                  <span className="text-[9px] font-mono text-slate-400 mt-0.5">{att.receipt_no}</span>
                                )}
                              </div>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 font-black rounded-full text-[10px] animate-pulse">
                                UNPAID FINE
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isReadOnlyStudent ? (
                              hasPenalty && !isPaid ? (
                                <span className="text-rose-600 text-xs font-bold">Settle at SSC Treasury</span>
                              ) : hasPenalty && isPaid ? (
                                <span className="text-emerald-700 text-xs font-bold flex items-center justify-end gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Settled
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs font-medium">Cleared</span>
                              )
                            ) : hasPenalty && !isPaid ? (
                              <button
                                onClick={() => handleSettlePenalty(att.id, att.student_name, amount)}
                                className="px-3 py-1.5 bg-[#00873E] hover:bg-[#007033] text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer flex items-center gap-1 ml-auto"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Collect ₱{amount.toFixed(2)}</span>
                              </button>
                            ) : hasPenalty && isPaid ? (
                              <span className="text-emerald-700 text-xs font-bold flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Settled
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-medium">Cleared</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CREATE SEMESTER EVENT (never available to read-only students) */}
      {!isReadOnlyStudent && activeTab === 'create_event' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg">Create Semester Activity / Event</h3>
              <p className="text-xs text-slate-500">Configure event details and absence penalty fine policy for {activeSemester.school_year_label}</p>
            </div>
          </div>

          <form onSubmit={handleCreateEventSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 uppercase">Event Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. 2024 JPIA Accountancy General Assembly & Symposium"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white rounded-xl border border-slate-200 font-bold text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase">Host Department</label>
                {isDepartmentRestricted ? (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-bold flex items-center justify-between">
                    <span>{userDepartment} - {scopedDepartmentInfo.name}</span>
                    <span className="text-[10px] bg-blue-200 text-blue-950 px-2 py-0.5 rounded font-black">LOCKED</span>
                  </div>
                ) : (
                  <select
                    value={eventDept}
                    onChange={(e) => setEventDept(e.target.value as DepartmentCode)}
                    className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-semibold"
                  >
                    {Object.keys(DEPARTMENTS).map(code => (
                      <option key={code} value={code}>{code} - {DEPARTMENTS[code as DepartmentCode].name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase">Event Category / Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-semibold"
                >
                  <option value="Academic">Academic / Symposium</option>
                  <option value="Event">Event / Summit</option>
                  <option value="Institutional">Institutional / All-Colleges</option>
                  <option value="Revenue">Revenue / Trade Expo</option>
                  <option value="Operations">Operations / Workshop</option>
                  <option value="Capital">Capital / Colloquium</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase">Event Date</label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase">Venue / Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NCF Audio-Visual Theater 1"
                  value={eventVenue}
                  onChange={(e) => setEventVenue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase">Penalty Fine for Unexcused Absence (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 uppercase">Objectives & Description</label>
              <textarea
                rows={3}
                placeholder="Brief event description, objectives, and agenda details..."
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#00873E] hover:bg-[#007033] text-white font-bold rounded-2xl shadow-md transition cursor-pointer text-sm"
            >
              Publish Event & Initialize Student Attendance Roster
            </button>
          </form>
        </div>
      )}

      {/* ATTENDANCE CHECK-IN MODAL */}
      {selectedEventForAttendance && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  Attendance Roster & Check-in
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedEventForAttendance.event_title} ({selectedEventForAttendance.event_date})
                </p>
              </div>
              <button 
                onClick={() => setSelectedEventForAttendance(null)} 
                className="text-slate-400 hover:text-white p-2 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <p className="text-slate-600">
                  Mark enrolled students as <strong>Present</strong>, <strong>Absent</strong>, or <strong>Excused</strong>. 
                  Unexcused absences incur a <strong>₱{(selectedEventForAttendance.penalty ?? selectedEventForAttendance.penalty_fee_amount ?? 50).toFixed(2)}</strong> penalty.
                </p>
                <button
                  onClick={() => {
                    displayStudents.forEach(stud => {
                      recordAttendance(selectedEventForAttendance.id, stud.id, 'Present');
                    });
                  }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-2xs whitespace-nowrap cursor-pointer"
                >
                  ✓ Mark All Present
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter student list..."
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div className="p-5 space-y-2 overflow-y-auto flex-1">
              {displayStudents
                .filter(stud => {
                  if (!attendanceSearch.trim()) return true;
                  const q = attendanceSearch.toLowerCase();
                  return (
                    stud.first_name.toLowerCase().includes(q) ||
                    stud.last_name.toLowerCase().includes(q) ||
                    stud.student_number.toLowerCase().includes(q)
                  );
                })
                .map((stud) => {
                  const existingAtt = attendances.find(
                    a => a.event_id === selectedEventForAttendance.id && (a.student_id === stud.id || a.student_number === stud.student_number)
                  );

                  const status = existingAtt ? existingAtt.status : 'Pending';

                  return (
                    <div key={stud.id} className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{stud.first_name} {stud.last_name}</p>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {stud.student_number}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {stud.course} • Section {stud.section}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => recordAttendance(selectedEventForAttendance.id, stud.id, 'Present')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                            status === 'Present'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700'
                          }`}
                        >
                          ✓ Present
                        </button>
                        <button
                          onClick={() => recordAttendance(selectedEventForAttendance.id, stud.id, 'Absent')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                            status === 'Absent'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700'
                          }`}
                        >
                          ✗ Absent
                        </button>
                        <button
                          onClick={() => recordAttendance(selectedEventForAttendance.id, stud.id, 'Excused')}
                          className={`px-2.5 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                            status === 'Excused'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700'
                          }`}
                        >
                          Excused
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {displayStudents.length} students enrolled in {isDepartmentRestricted ? userDepartment : 'department'}
              </span>
              <button
                onClick={() => setSelectedEventForAttendance(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Done & Save Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
