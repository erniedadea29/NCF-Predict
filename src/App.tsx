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

function MainAppContent() {
  const { currentTab, setCurrentTab, isReadOnlyStudent } = useApp();

  // Modals state
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isCreateProposalOpen, setIsCreateProposalOpen] = useState(false);
  const [activeProposalIdForFinance, setActiveProposalIdForFinance] = useState<string | null>(null);
  const [activeProposalIdForLiquidation, setActiveProposalIdForLiquidation] = useState<string | null>(null);

  // Students only ever get view-only access: keep them locked to their portal
  // and events tabs even if application state tries to point elsewhere.
  const studentAllowedTabs = ['student_portal', 'events_attendance'];
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

        {!isReadOnlyStudent && currentTab.toUpperCase() === 'TRANSACTIONS' && (
          <TransactionsView onOpenAddModal={() => setIsAddTxOpen(true)} />
        )}

        {!isReadOnlyStudent && (currentTab.toUpperCase() === 'BUDGET_PROPOSALS' ||
          currentTab.toUpperCase() === 'BUDGET' ||
          currentTab.toUpperCase() === 'REIMBURSE') && (
          <BudgetProposalWorkflow
            onOpenCreateProposal={() => setIsCreateProposalOpen(true)}
            onOpenBudgetRequestModal={(id) => setActiveProposalIdForFinance(id)}
            onOpenLiquidationModal={(id) => setActiveProposalIdForLiquidation(id)}
          />
        )}

        {!isReadOnlyStudent && currentTab.toUpperCase() === 'SAF_STUDENTS' && (
          <SafCollectionAndStudents />
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
  const { isAuthenticated } = useApp();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Always land back on the Login page (not wherever they last were) after logging out.
  useEffect(() => {
    if (!isAuthenticated) setAuthView('login');
  }, [isAuthenticated]);

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
