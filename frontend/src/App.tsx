import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
  uptime: number;
  database: {
    status: string;
    name: string;
  };
  version: string;
}

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await axios.get<HealthResponse>('/api/health');
        setHealth(response.data);
        setError(null);
      } catch (err: unknown) {
        setError('Backend API not yet reachable or server is starting up.');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-md border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-2xl font-bold shadow-sm">
            💊
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pharmacy Management System</h1>
            <p className="text-sm text-slate-500">Algions AI Labs — Full-Stack Internship Assessment</p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-emerald-900 uppercase tracking-wide">Foundation Status</h2>
            <p className="text-sm text-emerald-800 mt-1">
              Project initialized successfully with React 18, TypeScript, Tailwind CSS, Node.js, Express, and MongoDB architecture.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Backend Connection</h3>
            {loading ? (
              <p className="text-sm text-slate-500 animate-pulse">Checking API health status...</p>
            ) : health ? (
              <div className="space-y-1 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span>API Status:</span>
                  <span className="font-semibold text-emerald-600">Online ({health.message})</span>
                </div>
                <div className="flex justify-between">
                  <span>Database:</span>
                  <span className="font-semibold text-emerald-600">{health.database.status} ({health.database.name})</span>
                </div>
                <div className="flex justify-between">
                  <span>System Version:</span>
                  <span className="font-mono text-slate-800">v{health.version}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-amber-700">
                <span>{error}</span>
                <p className="text-xs text-slate-500 mt-1">Run backend server on port 5000 to connect.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
          Developed for Algions AI Labs Internship Assessment | Phase 1 Foundation
        </div>
      </div>
    </div>
  );
};

export default App;
