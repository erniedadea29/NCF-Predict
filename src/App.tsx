import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
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

const STAFF_ROLES = ['csc_adviser', 'dean', 'admin'];

function MainAppContent() {
  const { currentTab, setCurrentTab, isReadOnlyStudent, currentUser } = useApp();

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-[#00873E] selection:text-white">
      {/* Top Header (includes role-aware navigation) */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
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
          currentTab.toUpperCase() === 'BUDGET' ||
          currentTab.toUpperCase() === 'REIMBURSE') && (
          <BudgetProposalWorkflow
            onOpenCreateProposal={() => setIsCreateProposalOpen(true)}
            onOpenBudgetRequestModal={(id) => setActiveProposalIdForFinance(id)}
            onOpenLiquidationModal={(id) => setActiveProposalIdForLiquidation(id)}
          />
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
  const { isAuthenticated, isAuthLoading } = useApp();
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
