import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import DashboardPage from '@/pages/DashboardPage';
import MissionOrdersPage from '@/pages/MissionOrdersPage';
import EmployeesPage from '@/pages/EmployeesPage';
import VehiclesPage from '@/pages/VehiclesPage';
import ProjectsPage from '@/pages/ProjectsPage';
import SettingsPage from '@/pages/SettingsPage';
import LoginPage from '@/pages/LoginPage';
import { useAuth } from '@/lib/AuthContext';
import type { Page } from '@/lib/types';

function App() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar current={page} onNavigate={setPage} />
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {page === 'dashboard' && <DashboardPage />}
          {page === 'mission-orders' && <MissionOrdersPage />}
          {page === 'employees' && <EmployeesPage />}
          {page === 'vehicles' && <VehiclesPage />}
          {page === 'projects' && <ProjectsPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

export default App;
