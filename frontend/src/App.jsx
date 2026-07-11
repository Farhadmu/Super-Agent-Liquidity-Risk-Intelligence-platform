import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8080';

function App() {
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' or 'ops'
  const [agentsList, setAgentsList] = useState([
    { id: 1, code: 'A001', name: 'Sajib Telecom (Dhaka)' },
    { id: 2, code: 'A002', name: 'Mayer Doa Enterprise (Chittagong)' },
    { id: 3, code: 'A003', name: 'Riyad Variety Store (Sylhet)' },
    { id: 4, code: 'A004', name: 'Bismillah Store (Dhaka)' }
  ]);
  const [selectedAgentId, setSelectedAgentId] = useState(1);
  const [agentOverview, setAgentOverview] = useState(null);
  const [agentForecasts, setAgentForecasts] = useState(null);
  const [agentAnomalies, setAgentAnomalies] = useState([]);
  
  // Ops State
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRole, setFilterRole] = useState('');
  
  // Note/Action Input State
  const [noteType, setNoteType] = useState(''); // 'escalate', 'resolve', 'note'
  const [customNote, setCustomNote] = useState('');
  const [actorName, setActorName] = useState('Ops Officer Amina');
  const [actorRole, setActorRole] = useState('provider_ops'); // or 'risk_analyst', 'field_officer'

  // Validation Metrics State
  const [metrics, setMetrics] = useState(null);
  const [showMetrics, setShowMetrics] = useState(false);
  
  // Seeding State
  const [seedMessage, setSeedMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch Agent Data
  useEffect(() => {
    if (activeTab === 'agent' && selectedAgentId) {
      fetchAgentData(selectedAgentId);
    }
  }, [selectedAgentId, activeTab]);

  // Fetch Cases Data
  useEffect(() => {
    if (activeTab === 'ops') {
      fetchCases();
    }
  }, [activeTab, filterStatus, filterRole]);

  // Sync selected case details when list changes
  useEffect(() => {
    if (selectedCaseId && cases.length > 0) {
      const match = cases.find(c => c.id === selectedCaseId);
      if (match) setSelectedCase(match);
    } else {
      setSelectedCase(null);
    }
  }, [selectedCaseId, cases]);

  const fetchAgentData = async (id) => {
    try {
      setLoading(true);
      const overviewRes = await fetch(`${API_BASE}/agents/${id}/overview`);
      const overview = await overviewRes.json();
      setAgentOverview(overview);

      const forecastRes = await fetch(`${API_BASE}/agents/${id}/liquidity-forecast`);
      const forecasts = await forecastRes.json();
      setAgentForecasts(forecasts);

      const anomalyRes = await fetch(`${API_BASE}/agents/${id}/anomalies`);
      const anomalies = await anomalyRes.json();
      setAgentAnomalies(anomalies);
    } catch (err) {
      console.error("Error fetching agent data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async () => {
    try {
      setLoading(true);
      let url = `${API_BASE}/cases?`;
      if (filterStatus) url += `status=${filterStatus}&`;
      if (filterRole) url += `role=${filterRole}&`;
      
      const res = await fetch(url);
      const data = await res.json();
      setCases(data);
      if (data.length > 0 && !selectedCaseId) {
        setSelectedCaseId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching cases:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchValidationMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/metrics/validation`);
      const data = await res.json();
      setMetrics(data);
      setShowMetrics(true);
    } catch (err) {
      console.error("Error fetching validation metrics:", err);
    }
  };

  const triggerSeed = async () => {
    try {
      setLoading(true);
      setSeedMessage("Seeding in progress...");
      const res = await fetch(`${API_BASE}/simulate/seed`, { method: 'POST' });
      const data = await res.json();
      setSeedMessage(data.message);
      
      // Wait 3 seconds and refresh
      setTimeout(() => {
        setSeedMessage("");
        if (activeTab === 'agent') {
          fetchAgentData(selectedAgentId);
        } else {
          fetchCases();
        }
        fetchValidationMetrics();
      }, 3000);
    } catch (err) {
      setSeedMessage("Error triggering seed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Case Actions
  const handleAcknowledge = async (caseId) => {
    try {
      const res = await fetch(`${API_BASE}/cases/${caseId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_role: actorRole, actor_name: actorName })
      });
      if (res.ok) {
        fetchCases();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransitionSubmit = async (caseId) => {
    if (!customNote.trim()) return;
    try {
      let endpoint = 'notes';
      if (noteType === 'escalate') endpoint = 'escalate';
      if (noteType === 'resolve') endpoint = 'resolve';

      const res = await fetch(`${API_BASE}/cases/${caseId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_role: actorRole, note: customNote })
      });
      if (res.ok) {
        setCustomNote('');
        setNoteType('');
        fetchCases();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <header>
        <div className="logo-container">
          <div className="logo-icon">Ω</div>
          <div>
            <h1 className="logo-text">SUPER-AGENT</h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'bold', tracking: '0.05em' }}>
              MULTI-PROVIDER COORDINATION PORTAL
            </span>
          </div>
        </div>
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            Agent Dashboard
          </button>
          <button 
            className={`toggle-btn ${activeTab === 'ops' ? 'active' : ''}`}
            onClick={() => setActiveTab('ops')}
          >
            Ops Control Room
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={fetchValidationMetrics}>
            Validation Metrics
          </button>
          <button className="btn btn-primary" onClick={triggerSeed} disabled={loading}>
            Reset / Seed Data
          </button>
        </div>
      </header>

      <main className="main-content">
        {seedMessage && (
          <div className="glass-card" style={{ marginBottom: '1.5rem', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--color-accent)' }}>
            <p style={{ fontWeight: 'bold', color: '#fff' }}>⚡ {seedMessage}</p>
          </div>
        )}

        {/* Validation Metrics Modal / Drawer Overlay */}
        {showMetrics && metrics && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <div className="glass-card" style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-main)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="details-title">System & Analytical Metrics</h2>
                <button className="btn btn-secondary" onClick={() => setShowMetrics(false)}>Close</button>
              </div>
              
              <div className="metrics-report">
                <div>
                  <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    Anomaly Detection (IsolationForest)
                  </h3>
                  <div className="metric-row">
                    <span className="metric-label">Precision (Suspect Detection)</span>
                    <span className="metric-value success">{(metrics.anomaly_detection.precision * 100).toFixed(1)}%</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Recall (Sensitivity)</span>
                    <span className="metric-value success">{(metrics.anomaly_detection.recall * 100).toFixed(1)}%</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Normal False-Positive Rate (FPR)</span>
                    <span className="metric-value warning">{(metrics.anomaly_detection.false_positive_rate * 100).toFixed(2)}%</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">True Positives / False Positives</span>
                    <span className="metric-value">{metrics.anomaly_detection.true_positives} / {metrics.anomaly_detection.false_positives}</span>
                  </div>
                </div>

                <div>
                  <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    Liquidity Forecasting
                  </h3>
                  <div className="metric-row">
                    <span className="metric-label">Shortage Warning Lead Time</span>
                    <span className="metric-value success">{metrics.liquidity_forecasting.lead_time_minutes} Mins</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Forecast Timeline Accuracy</span>
                    <span className="metric-value">{(metrics.liquidity_forecasting.accuracy_ratio * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '0.35rem', marginTop: '0.5rem' }}>
                    💡 {metrics.liquidity_forecasting.context}
                  </div>
                </div>

                <div>
                  <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    API Performance & Scalability
                  </h3>
                  <div className="metric-row">
                    <span className="metric-label">Average API Latency</span>
                    <span className="metric-value">{metrics.system_performance.average_api_latency_ms} ms</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">95th Percentile Latency (p95)</span>
                    <span className="metric-value">{metrics.system_performance.p95_api_latency_ms} ms</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Active Records (Transactions Scale)</span>
                    <span className="metric-value">{metrics.system_performance.data_scale_transactions} rows</span>
                  </div>
                </div>

                <div>
                  <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    Explainability & Transparency
                  </h3>
                  <div className="metric-row">
                    <span className="metric-label">Alert Explanation Coverage</span>
                    <span className="metric-value success">{metrics.explainability.explanation_coverage_percentage}%</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Evidence Schema Standardized</span>
                    <span className="metric-value success">Yes (velocity, proximity, temporal)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Agent Dashboard */}
        {activeTab === 'agent' && (
          <div className="agent-grid">
            {/* Sidebar with Selector */}
            <div className="sidebar">
              <div className="glass-card">
                <h3 className="agent-selector-title">Select Active Agent</h3>
                <div className="agent-selector-list">
                  {agentsList.map(a => (
                    <div 
                      key={a.id} 
                      className={`agent-selector-item ${selectedAgentId === a.id ? 'active' : ''}`}
                      onClick={() => setSelectedAgentId(a.id)}
                    >
                      <div>
                        <div className="agent-selector-code">{a.code}</div>
                        <div className="agent-selector-area">{a.name}</div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: selectedAgentId === a.id ? 'var(--color-accent)' : 'var(--text-muted)' }}>▶</div>
                    </div>
                  ))}
                </div>
              </div>

              {agentOverview && (
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    Agent Info & Location
                  </h4>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#fff' }}>
                      {agentOverview.agent_code === 'A001' ? 'Sajib Telecom' : 
                       agentOverview.agent_code === 'A002' ? 'Mayer Doa Enterprise' :
                       agentOverview.agent_code === 'A003' ? 'Riyad Variety Store' : 'Bismillah Store'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {agentOverview.area}, {agentOverview.thana}, {agentOverview.district}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--bg-card-border)', paddingTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    🚨 Provider boundaries strictly maintained. Balances never auto-settled or converted.
                  </div>
                </div>
              )}
            </div>

            {/* Dashboard Content */}
            <div className="dashboard-main">
              {agentOverview && (
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem', color: '#fff' }}>
                    Liquidity Overview
                  </h2>
                  <div className="balance-grid">
                    {/* Shared Cash Card */}
                    <div className="glass-card balance-card">
                      <span className="balance-label">Shared Cash Pool</span>
                      <span className="balance-amount">
                        {agentOverview.shared_cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        <span className="balance-currency">BDT</span>
                      </span>
                      <div className="balance-update">
                        <span>Physical Cash Box</span>
                        <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>● Active</span>
                      </div>
                    </div>

                    {/* Providers Cards */}
                    {agentOverview.provider_balances.map(pb => (
                      <div 
                        key={pb.provider_id} 
                        className={`glass-card balance-card ${pb.is_delayed ? 'pulse-card' : ''}`}
                        style={{ '--provider-color': pb.display_color }}
                      >
                        <span className="balance-label">
                          <span className="badge-provider" style={{ backgroundColor: pb.display_color }}>
                            {pb.provider_name}
                          </span>
                          E-Money Balance
                        </span>
                        <span className="balance-amount">
                          {pb.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          <span className="balance-currency">BDT</span>
                        </span>
                        <div className="balance-update">
                          <span>Wallet Balance</span>
                          {pb.is_delayed ? (
                            <span style={{ color: 'var(--color-warning)', fontWeight: 'bold' }}>⏳ FEED DELAY</span>
                          ) : (
                            <span>Updated just now</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forecast and Anomaly alerts */}
              <div className="forecast-section">
                {/* Active Liquidity Risk Forecasts */}
                <div className="glass-card">
                  <h3 className="alert-panel-title">
                    <span style={{ color: 'var(--color-warning)' }}>⏳</span> Liquidity Shortage Risk
                  </h3>
                  
                  {agentForecasts && agentForecasts.forecasts.map((f, i) => {
                    const hasRisk = f.risk_level !== 'low' || f.confidence < 0.3;
                    return (
                      <div key={i} className={`alert-card ${f.risk_level}`}>
                        <div className="alert-card-header">
                          <span className="alert-provider" style={{ color: f.provider_id ? f.display_color : '#fff' }}>
                            {f.provider_name}
                          </span>
                          <span className={`alert-badge ${f.risk_level}`}>
                            {f.risk_level === 'low' && f.confidence < 0.3 ? 'Uncertain / Lagging' : `${f.risk_level} Risk`}
                          </span>
                        </div>

                        {f.eta_minutes !== null ? (
                          <div className="alert-time">
                            Shortage ETA: ~{f.eta_minutes} Mins
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            No impending shortage detected
                          </div>
                        )}

                        {/* Bilingual Bangla alert for Scenario A or B */}
                        {hasRisk && (
                          <div className="alert-msg-bilingual">
                            <span className="alert-msg-en">{f.reason}</span>
                            {f.provider_name === 'bKash' && f.risk_level === 'high' && (
                              <span className="alert-msg-bn">
                                📣 বর্তমান লেনদেনের ধারা অনুযায়ী কয়েক মিনিটের মধ্যে আপনার বিকাশ ই-মানি শেষ হয়ে যেতে পারে। নিরাপদে সেবা চালু রাখতে অতিরিক্ত ই-মানি টপ-আপ করার পরামর্শ দেওয়া হচ্ছে।
                              </span>
                            )}
                            {f.provider_name === 'Shared Cash' && f.risk_level === 'high' && (
                              <span className="alert-msg-bn">
                                📣 বর্তমান লেনদেনের ধারা অনুযায়ী আপনার ড্রয়ারের নগদ টাকা শেষ হয়ে যেতে পারে। সবচেয়ে বেশি চাপ আসছে বিকাশ ক্যাশ-আউট থেকে। ২০,০০০+ টাকা অতিরিক্ত নগদ রিফিল করুন।
                              </span>
                            )}
                            {f.confidence < 0.3 && (
                              <span className="alert-msg-bn">
                                ⚠️ রকেট তথ্য সরবরাহে সাময়িক বিলম্ব হচ্ছে। সঠিক পূর্বাভাসের জন্য অপেক্ষা করা হচ্ছে, অনুগ্রহ করে সর্বশেষ ব্যাংক স্টেটমেন্ট দেখে সিদ্ধান্ত নিন।
                              </span>
                            )}
                          </div>
                        )}

                        <div className="alert-meta">
                          <div>
                            <div>Confidence Score</div>
                            <div style={{ fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {(f.confidence * 100).toFixed(0)}%
                              <div className="confidence-bar-container">
                                <div 
                                  className="confidence-bar" 
                                  style={{ 
                                    width: `${f.confidence * 100}%`, 
                                    backgroundColor: f.confidence > 0.7 ? 'var(--color-success)' : f.confidence > 0.4 ? 'var(--color-warning)' : 'var(--color-danger)'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div>Current Balance</div>
                            <div style={{ fontWeight: 'bold', color: '#fff' }}>{f.current_balance.toLocaleString()} BDT</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Active Anomaly Alerts */}
                <div className="glass-card">
                  <h3 className="alert-panel-title">
                    <span style={{ color: 'var(--color-danger)' }}>⚡</span> Behavioral Risk Flags
                  </h3>
                  
                  {agentAnomalies.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                      No unusual behavioral activity detected in the last 2 hours.
                    </p>
                  ) : (
                    agentAnomalies.map((a, i) => (
                      <div key={i} className="alert-card" style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                        <div className="alert-card-header">
                          <span className="alert-provider" style={{ color: a.display_color }}>
                            {a.provider_name}
                          </span>
                          <span className="alert-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            Requires Review
                          </span>
                        </div>

                        <div>
                          <div style={{ fontWeight: 'bold', color: '#fff', textTransform: 'capitalize' }}>
                            Pattern: {a.pattern_type.replace(/_/g, ' ')}
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Decision Score: {(a.anomaly_score * 100).toFixed(1)}% (Confidence: {(a.confidence * 100).toFixed(0)}%)
                          </p>
                        </div>

                        {/* Bilingual Bangla Warning for Scenario B */}
                        {a.pattern_type === 'near_identical_amounts' && (
                          <div className="alert-msg-bilingual" style={{ borderLeftColor: 'var(--color-danger)' }}>
                            <span className="alert-msg-en">
                              Alert: Detected cluster of near-identical cash-out amounts from a small group of accounts.
                            </span>
                            <span className="alert-msg-bn">
                              📣 গত ১২ মিনিটে স্বাভাবিকের তুলনায় অনেক বেশি ক্যাশ-আউট হয়েছে। কয়েকটি লেনদেনের পরিমাণ একই এবং অল্প কয়েকটি অ্যাকাউন্ট থেকে বারবার অনুরোধ এসেছে। বড় অঙ্কের নগদ পুনরায় সরবরাহের আগে পর্যালোচনা করুন।
                            </span>
                          </div>
                        )}

                        <div className="details-section-title" style={{ margin: '0.25rem 0' }}>Evidence Parameters</div>
                        <div className="evidence-grid">
                          <div>Tx ID: <span style={{ color: '#fff' }}>#{a.evidence.transaction_id}</span></div>
                          <div>Amount: <span style={{ color: '#fff' }}>{a.evidence.amount} BDT</span></div>
                          <div>Mean: <span style={{ color: '#fff' }}>{a.evidence.historical_mean} BDT</span></div>
                          <div>Dev: <span style={{ color: 'var(--color-danger)' }}>+{a.evidence.amount_deviation} BDT</span></div>
                          <div>Velocity (10m): <span style={{ color: '#fff' }}>{a.evidence.velocity_10m} tx</span></div>
                          <div>Repetition (30m): <span style={{ color: '#fff' }}>{a.evidence.counterparty_repetition_30m} tx</span></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Ops Control Room (Cases) */}
        {activeTab === 'ops' && (
          <div className="ops-grid">
            {/* Left side: Case Queue list */}
            <div>
              <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <h3 className="alert-panel-title">Operations Case Queue</h3>
                <div className="filter-bar">
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Status</label>
                    <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="">All Statuses</option>
                      <option value="open">Open</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="escalated">Escalated</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Assigned Role</label>
                    <select className="filter-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                      <option value="">All Roles</option>
                      <option value="provider_ops">Provider Operations</option>
                      <option value="field_officer">Field Officer</option>
                      <option value="risk_analyst">Risk Analyst</option>
                    </select>
                  </div>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', background: 'rgba(31,41,55,0.4)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem' }}>Acting As: </div>
                    <select 
                      className="filter-select" 
                      style={{ padding: '0.15rem 0.5rem', background: 'transparent', border: 'none' }}
                      value={actorRole} 
                      onChange={e => {
                        setActorRole(e.target.value);
                        if (e.target.value === 'provider_ops') setActorName('Ops Officer Amina');
                        if (e.target.value === 'field_officer') setActorName('Territory Officer Tanvir');
                        if (e.target.value === 'risk_analyst') setActorName('Analyst Farhan');
                      }}
                    >
                      <option value="provider_ops">Provider Ops (Amina)</option>
                      <option value="field_officer">Field Officer (Tanvir)</option>
                      <option value="risk_analyst">Risk Analyst (Farhan)</option>
                    </select>
                  </div>
                </div>
              </div>

              {cases.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>No active cases match the current filters.</p>
                </div>
              ) : (
                <div className="case-queue-list">
                  {cases.map(c => (
                    <div 
                      key={c.id} 
                      className={`case-card ${selectedCaseId === c.id ? 'active' : ''}`}
                      onClick={() => setSelectedCaseId(c.id)}
                    >
                      <div className="case-card-info">
                        <div className="case-card-meta">
                          <span style={{ color: c.display_color, fontWeight: 'bold' }}>
                            {c.provider_name}
                          </span>
                          <span>•</span>
                          <span>Agent {c.agent_code} ({c.agent_area})</span>
                          <span>•</span>
                          <span>{new Date(c.created_at).toLocaleTimeString()}</span>
                        </div>
                        <div className="case-card-title">
                          {c.source_type === 'liquidity' ? 'Wallet Shortage Threat' : 'Behavioral Pattern Anomaly'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Routed To: <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{c.assigned_role}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span className={`case-card-status ${c.status}`}>{c.status}</span>
                        <div style={{ fontSize: '1rem', color: selectedCaseId === c.id ? 'var(--color-accent)' : 'var(--text-muted)' }}>▶</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right side: Selected Case Detail pane */}
            <div>
              {selectedCase ? (
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="details-header">
                    <div>
                      <h2 className="details-title">
                        {selectedCase.source_type === 'liquidity' ? 'Liquidity Shortage Case' : 'Behavioral Risk Review'}
                      </h2>
                      <p className="details-subtitle">
                        Case ID: #{selectedCase.id} • Agent: {selectedCase.agent_code}
                      </p>
                    </div>
                    <span className={`case-card-status ${selectedCase.status}`}>{selectedCase.status}</span>
                  </div>

                  <div>
                    <div className="details-section-title">Case Owner</div>
                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem' }}>
                      {selectedCase.assigned_to ? `👤 ${selectedCase.assigned_to} (${selectedCase.assigned_role})` : '👥 Unassigned (Open Queue)'}
                    </div>
                  </div>

                  <div>
                    <div className="details-section-title">Recommended Coordination Action</div>
                    <div className="recommended-action-box">
                      {selectedCase.recommended_action}
                    </div>
                  </div>

                  {/* Actions buttons based on status */}
                  <div>
                    <div className="details-section-title">Case Management Actions</div>
                    
                    <div className="action-buttons-grid">
                      {selectedCase.status === 'open' && (
                        <button 
                          className="btn btn-primary"
                          onClick={() => handleAcknowledge(selectedCase.id)}
                        >
                          Acknowledge Case
                        </button>
                      )}
                      
                      {selectedCase.status !== 'resolved' ? (
                        <>
                          <button 
                            className="btn btn-warning"
                            onClick={() => { setNoteType('escalate'); setCustomNote(''); }}
                          >
                            Escalate Case
                          </button>
                          <button 
                            className="btn btn-success"
                            onClick={() => { setNoteType('resolve'); setCustomNote(''); }}
                          >
                            Resolve Case
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-disabled" disabled>Case Resolved</button>
                      )}
                      
                      <button 
                        className="btn btn-secondary"
                        onClick={() => { setNoteType('note'); setCustomNote(''); }}
                        style={{ gridColumn: 'span 2' }}
                      >
                        Add Timeline Note
                      </button>
                    </div>
                  </div>

                  {/* Action Transition Note Form */}
                  {noteType && (
                    <div className="note-input-container">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-warning)', textTransform: 'uppercase' }}>
                          Confirm {noteType} action
                        </span>
                        <button style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setNoteType('')}>✕</button>
                      </div>
                      <textarea
                        className="input-textarea"
                        placeholder={`Write the details of the ${noteType}...`}
                        value={customNote}
                        onChange={e => setCustomNote(e.target.value)}
                      />
                      <button className="btn btn-primary" onClick={() => handleTransitionSubmit(selectedCase.id)}>
                        Submit {noteType}
                      </button>
                    </div>
                  )}

                  {/* Case Timeline Events Audit Trail */}
                  <div>
                    <div className="details-section-title">Case Coordination Audit Trail</div>
                    <div className="timeline-container">
                      {selectedCase.timeline.map((e, index) => (
                        <div key={index} className="timeline-event">
                          <div className={`timeline-dot ${e.event_type}`} />
                          <div className="timeline-meta">
                            <span className="timeline-actor">{e.actor_role.toUpperCase()} ({e.event_type})</span>
                            <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                          </div>
                          <div className="timeline-note">{e.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>Select a case from the queue to view details and coordinate.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default App;
