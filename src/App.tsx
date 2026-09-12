import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Header } from './components/Header';
import { HomeDashboard } from './components/HomeDashboard';
import { TransactionsView } from './components/TransactionsView';
import { BudgetProposalWorkflow } from './components/BudgetProposalWorkflow';
import { SafCollectionAndStudents } from './components/SafCollectionAndStudents';
import { StudentDashboardView } from './components/StudentDashboardView';
import { EventsAndPenalties } from './components/EventsAndPenalties';
import { MLForecastView } from './components/MLForecastView';
import { AddTransactionModal } from './components/AddTransactionModal';
import { CreateProposalModal } from './components/CreateProposalModal';
import { BudgetRequestExpensesModal } from './components/BudgetRequestExpensesModal';
import { LiquidationReturnModal } from './components/LiquidationReturnModal';
import { LiquidationReportDashboard } from './components/LiquidationReportDashboard';
import { ManageUsersView } from './components/ManageUsersView';
import { ReimbursementReviewPanel } from './components/ReimbursementReviewPanel';
import { PastRecordsView } from './components/PastRecordsView';
import { Clock } from 'lucide-react';

const STAFF_ROLES = ['csc_adviser', 'dean', 'admin', 'super_admin'];

function MainAppContent() {
  const { currentTab, setCurrentTab, isReadOnlyStudent, isAdminSystemOnly, isViewOnlyReviewer, isEmployeeAwaitingAssignment, currentUser } = useApp();

  // Modals state
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isCreateProposalOpen, setIsCreateProposalOpen] = useState(false);
  const [activeProposalIdForFinance, setActiveProposalIdForFinance] = useState<string | null>(null);
  const [activeProposalIdForLiquidation, setActiveProposalIdForLiquidation] = useState<string | null>(null);

  // Students now additionally get read-only Budget and Expenses views
  // alongside their portal and events/penalties — both components self-gate
  // their own mutating UI internally for isReadOnlyStudent.
  const studentAllowedTabs = ['student_portal', 'budget', 'expenses', 'events_attendance'];
  useEffect(() => {
    if (isReadOnlyStudent && !studentAllowedTabs.includes(currentTab.toLowerCase())) {
      setCurrentTab('student_portal');
    }
  }, [isReadOnlyStudent, currentTab, setCurrentTab]);

  // Admin is system-management only — force them onto Manage Users since
  // Home/Budget/Transactions/etc. are never in their nav.
  useEffect(() => {
    if (isAdminSystemOnly && currentTab.toLowerCase() !== 'manage_users') {
      setCurrentTab('manage_users');
    }
  }, [isAdminSystemOnly, currentTab, setCurrentTab]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-[#00873E] selection:text-white">
      {/* Top Header (includes role-aware navigation) */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {isEmployeeAwaitingAssignment ? (
          <div className="max-w-lg mx-auto text-center py-16 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Awaiting Assignment</h2>
            <p className="text-sm text-slate-500">
              Your Employee account is active, but you haven't been assigned a role yet. Once an Admin, Dean, or
              your department's leadership promotes you, your dashboard will appear here automatically — just log
              back in after you've been notified.
            </p>
          </div>
        ) : (
        <>
        {!isReadOnlyStudent && (currentTab.toUpperCase() === 'HOME' || currentTab.toUpperCase() === 'OVERVIEW') && (
          <HomeDashboard
            onOpenAddTransaction={() => setIsAddTxOpen(true)}
            onOpenCreateProposal={() => setIsCreateProposalOpen(true)}
          />
        )}

        {!isReadOnlyStudent && (currentTab.toUpperCase() === 'FORECAST' || currentTab.toUpperCase() === 'ML_FORECAST') && (
          <MLForecastView />
        )}

        {(!isReadOnlyStudent && currentTab.toUpperCase() === 'TRANSACTIONS' ||
          isReadOnlyStudent && currentTab.toUpperCase() === 'EXPENSES') && (
          <TransactionsView onOpenAddModal={() => setIsAddTxOpen(true)} />
        )}

        {(currentTab.toUpperCase() === 'BUDGET_PROPOSALS' ||
          currentTab.toUpperCase() === 'BUDGET_APPROVALS' ||
          currentTab.toUpperCase() === 'BUDGET' ||
          currentTab.toUpperCase() === 'REIMBURSE') && (
          // Dean/Adviser's own "Reimbursement" tab still goes to the
          // reimbursement-claims queue; their new "Budget Approvals" tab
          // (and everyone else's Budget tab) goes to the actual proposal
          // workflow, where Adviser/Dean's Approve/Revision/Reject panels
          // and Dean's stage tracker actually live (Section 1/3a).
          (isViewOnlyReviewer && currentTab.toUpperCase() !== 'BUDGET_APPROVALS') ? (
            <ReimbursementReviewPanel />
          ) : (
            <BudgetProposalWorkflow
              onOpenCreateProposal={() => setIsCreateProposalOpen(true)}
              onOpenBudgetRequestModal={(id) => setActiveProposalIdForFinance(id)}
              onOpenLiquidationModal={(id) => setActiveProposalIdForLiquidation(id)}
            />
          )
        )}

        {!isReadOnlyStudent && (currentTab.toUpperCase() === 'LIQUIDATION_REPORTS' ||
          currentTab.toUpperCase() === 'LIQUIDATION') && (
          <LiquidationReportDashboard
            onOpenLiquidationModal={(id) => setActiveProposalIdForLiquidation(id)}
          />
        )}

        {!isReadOnlyStudent && currentTab.toUpperCase() === 'SAF_STUDENTS' && (
          <SafCollectionAndStudents />
        )}

        {STAFF_ROLES.includes(currentUser.role) && currentTab.toUpperCase() === 'MANAGE_USERS' && (
          <ManageUsersView />
        )}

        {currentUser.role === 'dean' && currentTab.toUpperCase() === 'PAST_ADVISER' && (
          <PastRecordsView />
        )}

        {currentUser.role === 'csc_adviser' && currentTab.toUpperCase() === 'PAST_OFFICER' && (
          <PastRecordsView />
        )}

        {(currentTab.toUpperCase() === 'STUDENT_PORTAL' ||
          currentTab.toUpperCase() === 'PROFILE' ||
          currentTab.toUpperCase() === 'STUDENT') && (
          <StudentDashboardView />
        )}

        {(currentTab.toUpperCase() === 'EVENTS_PENALTIES' ||
          currentTab.toUpperCase() === 'EVENTS_ATTENDANCE' ||
          currentTab.toUpperCase() === 'EVENTS') && (
          <EventsAndPenalties />
        )}
        </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-500 space-y-1">
        <p className="font-bold text-slate-700">
          Naga College Foundation (NCF) • Supreme Student Council (SSC)
        </p>
        <p className="text-[11px] text-slate-400">
          Student Activity Fund (SAF) & Budget Proposal Double-Entry Ledger System
        </p>
      </footer>

      {/* Global Modals (hidden entirely for read-only students) */}
      {!isReadOnlyStudent && (
        <>
          <AddTransactionModal
            isOpen={isAddTxOpen}
            onClose={() => setIsAddTxOpen(false)}
          />

          <CreateProposalModal
            isOpen={isCreateProposalOpen}
            onClose={() => setIsCreateProposalOpen(false)}
          />

          <BudgetRequestExpensesModal
            proposalId={activeProposalIdForFinance}
            isOpen={Boolean(activeProposalIdForFinance)}
            onClose={() => setActiveProposalIdForFinance(null)}
          />

          <LiquidationReturnModal
            proposalId={activeProposalIdForLiquidation}
            isOpen={Boolean(activeProposalIdForLiquidation)}
            onClose={() => setActiveProposalIdForLiquidation(null)}
          />
        </>
      )}
    </div>
  );
}

function AuthGate() {
  const { isAuthenticated, isAuthLoading, isPasswordRecovery } = useApp();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Always land back on the Login page (not wherever they last were) after logging out.
  useEffect(() => {
    if (!isAuthenticated) setAuthView('login');
  }, [isAuthenticated]);

  // Wait for the real Supabase session to be restored before deciding
  // whether to show the login page or the app — avoids a login-page flash
  // for someone who's actually already signed in.
  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#00873E] via-[#03693a] to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // A password-reset email link takes priority over everything else, even
  // an existing session.
  if (isPasswordRecovery) {
    return <ResetPasswordPage />;
  }

  // Not logged in -> the person is redirected straight to the Login page
  // (or Register page) and never sees the home page / dashboard.
  if (!isAuthenticated) {
    return authView === 'login' ? (
      <LoginPage onGoToRegister={() => setAuthView('register')} />
    ) : (
      <RegisterPage onGoToLogin={() => setAuthView('login')} />
    );
  }

  return <MainAppContent />;
}

export default function App() {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  );
}
