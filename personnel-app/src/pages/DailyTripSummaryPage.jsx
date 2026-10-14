import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { generatePDFSummaryReport } from '../services/pdfReportGenerator';
import { fetchBoardingEventCounts } from '../services/supabaseClient';
import { Calendar, RefreshCw } from 'lucide-react';

const timeframeStart = (timeframe) => {
  const start = new Date();
  if (timeframe === 'Week') start.setDate(start.getDate() - 7);
  else if (timeframe === 'Month') start.setMonth(start.getMonth() - 1);
  else if (timeframe === 'Year') start.setFullYear(start.getFullYear() - 1);
  else start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

export function DailyTripSummaryPage() {
  const { dutySession } = useAuth();
  const [timeframe, setTimeframe] = useState('Day');
  const [counts, setCounts] = useState({ boarded: 0, alighted: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await fetchBoardingEventCounts(timeframeStart(timeframe));
    if (result.success) setCounts(result.data);
    else setError(result.error);
    setLoading(false);
  }, [timeframe]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDownloadPDF = () => generatePDFSummaryReport({ timeframe, dutySession });

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
    <section className="card">
      <h1 style={{ fontSize: '1.6rem', marginBottom: '.3rem' }}>Operations Trip Summary</h1>
      <p style={{ color: '#94a3b8' }}>Passenger totals are calculated from recorded boarding and alighting scans.</p>
      <p style={{ color: '#94a3b8' }}>Duty bus: {dutySession?.plateNumber || 'All buses'}</p>
    </section>

    <section className="card" style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
      <Calendar size={18} color="#06b6d4" />
      <strong>Select timeframe:</strong>
      {['Day', 'Week', 'Month', 'Year'].map((value) => <button key={value} type="button" className={`btn ${timeframe === value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTimeframe(value)}>{value}</button>)}
      <button type="button" className="btn btn-secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</button>
    </section>

    {error && <div className="alert alert-danger">Could not load scan totals: {error}</div>}
    <section className="stats-grid">
      <div className="stat-card"><span>Boarding scans ({timeframe})</span><div className="stat-number">{loading ? '…' : counts.boarded}</div></div>
      <div className="stat-card"><span>Alighting scans ({timeframe})</span><div className="stat-number">{loading ? '…' : counts.alighted}</div></div>
    </section>
    <section className="card">
      <p>Totals include non-reversed records in the database for the selected period.</p>
      <button type="button" onClick={handleDownloadPDF} className="btn btn-primary">Download PDF Operations Report</button>
    </section>
  </div>;
}
