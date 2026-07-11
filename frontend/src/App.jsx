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

  // Error State
  const [error, setError] = useState(null);

  // Escape key to close metrics modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showMetrics) setShowMetrics(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showMetrics]);

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

      setError(null);
    } catch (err) {
      console.error("Error fetching agent data:", err);
      setError('Failed to connect to the server. Please check that the backend is running.');
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

      setError(null);
    } catch (err) {
      console.error("Error fetching cases:", err);
      setError('Failed to connect to the server. Please check that the backend is running.');
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

  const handleKeyActivate = (e, callback) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  };

  return (
    <>
      <header>
        <div className="logo-container">
          <div className="logo-icon">Ω</div>
          <div>
            <h1 className="logo-text">SUPER-AGENT</h1>
            <span className="logo-subtitle">
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
        <div className="header-actions">
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
          <div className="glass-card seed-message-card">
            <p className="seed-message-text">⚡ {seedMessage}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="glass-card error-container">
            <div className="error-icon">⚠️</div>
            <p className="error-message">{error}</p>
            <button className="btn btn-primary" onClick={() => { setError(null); activeTab === 'agent' ? fetchAgentData(selectedAgentId) : fetchCases(); }}>
              Retry Connection
            </button>
          </div>
        )}

        {/* Validation Metrics Modal / Drawer Overlay */}
        {showMetrics && metrics && (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Validation Metrics"
            onClick={() => setShowMetrics(false)}
          >
            <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="details-title">System & Analytical Metrics</h2>
                <button className="btn btn-secondary" onClick={() => setShowMetrics(false)}>Close</button>
              </div>
              
              <div className="metrics-report">
                <div>
                  <h3 className="metrics-section-title">
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
                  <h3 className="metrics-section-title">
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
                  <div className="metrics-info-box">
                    💡 {metrics.liquidity_forecasting.context}
                  </div>
                </div>

                <div>
                  <h3 className="metrics-section-title">
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
                  <h3 className="metrics-section-title">
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
          <div className="agent-grid fade-in">
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
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => handleKeyActivate(e, () => setSelectedAgentId(a.id))}
                    >
                      <div>
                        <div className="agent-selector-code">{a.code}</div>
                        <div className="agent-selector-area">{a.name}</div>
                      </div>
                      <div className="agent-selector-arrow">▶</div>
                    </div>
                  ))}
                </div>
              </div>

              {agentOverview && (
                <div className="glass-card agent-info-card">
                  <h4 className="agent-info-title">
                    Agent Info & Location
                  </h4>
                  <div>
                    <div className="agent-info-name">
                      {agentOverview.agent_code === 'A001' ? 'Sajib Telecom' : 
                       agentOverview.agent_code === 'A002' ? 'Mayer Doa Enterprise' :
                       agentOverview.agent_code === 'A003' ? 'Riyad Variety Store' : 'Bismillah Store'}
                    </div>
                    <div className="agent-info-location">
                      {agentOverview.area}, {agentOverview.thana}, {agentOverview.district}
                    </div>
                  </div>
                  <div className="agent-info-warning">
                    🚨 Provider boundaries strictly maintained. Balances never auto-settled or converted.
                  </div>
                </div>
              )}
            </div>

            {/* Dashboard Content */}
            <div className="dashboard-main">
              {/* Loading State */}
              {loading && !agentOverview && (
                <div className="loading-container">
                  <div className="loading-spinner" />
                  <span className="loading-text">Loading data...</span>
                </div>
              )}

              {agentOverview && (
                <div>
                  <h2 className="section-heading">
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
                        <span className="status-active">● Active</span>
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
                            <span className="status-delayed">⏳ FEED DELAY</span>
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
                  
                  {/* Loading state for forecasts */}
                  {loading && !agentForecasts && (
                    <div className="loading-container">
                      <div className="loading-spinner" />
                      <span className="loading-text">Loading data...</span>
                    </div>
                  )}

                  {/* Empty state for forecasts */}
                  {agentForecasts && (!agentForecasts.forecasts || agentForecasts.forecasts.length === 0) && (
                    <p className="empty-state-text">No active liquidity forecasts available.</p>
                  )}

                  {agentForecasts && agentForecasts.forecasts && agentForecasts.forecasts.map((f, i) => {
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
                          <div className="no-shortage-text">
                            No impending shortage detected
                          </div>
                        )}

                        {/* Bilingual Bangla alert for Scenario A or B */}
                        {hasRisk && (
                          <div className="alert-msg-bilingual">
                            <span className="alert-msg-en">{f.reason}</span>
                            {f.provider_name === 'bKash' && f.risk_level === 'high' && (
                              <span className="alert-msg-bn">
                                📣 বর্তমান লেনদেনের ধারা অনুযায়ী কয়েক মিনিটের মধ্যে আপনার বিকাশ ই-মানি শেষ হয়ে যেতে পারে। নিরাপদে সেবা চালু রাখতে অতিরিক্ত ই-মানি টপ-আপ করার পরামর্শ দেওয়া হচ্ছে।
                              </span>
                            )}
                            {f.provider_name === 'Shared Cash' && f.risk_level === 'high' && (
                              <span className="alert-msg-bn">
                                📣 বর্তমান লেনদেনের ধারা অনুযায়ী আপনার ড্রয়ারের নগদ টাকা শেষ হয়ে যেতে পারে। সবচেয়ে বেশি চাপ আসছে বিকাশ ক্যাশ-আউট থেকে। ২০,০০০+ টাকা অতিরিক্ত নগদ রিফিল করুন।
                              </span>
                            )}
                            {f.confidence < 0.3 && (
                              <span className="alert-msg-bn">
                                ⚠️ রকেট তথ্য সরবরাহে সাময়িক বিলম্ব হচ্ছে। সঠিক পূর্বাভাসের জন্য অপেক্ষা করা হচ্ছে, অনুগ্রহ করে সর্বশেষ ব্যাংক স্টেটমেন্ট দেখে সিদ্ধান্ত নিন।
                              </span>
                            )}
                          </div>
                        )}

                        <div className="alert-meta">
                          <div>
                            <div>Confidence Score</div>
                            <div className="confidence-display">
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
                          <div className="alert-meta-balance">
                            <div>Current Balance</div>
                            <div className="alert-meta-balance-value">{f.current_balance.toLocaleString()} BDT</div>
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
                    <p className="empty-state-text">
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
                          <div className="anomaly-pattern-label">
                            Pattern: {a.pattern_type.replace(/_/g, ' ')}
                          </div>
                          <p className="anomaly-score-text">
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
                              📣 গত ১২ মিনিটে স্বাভাবিকের তুলনায় অনেক বেশি ক্যাশ-আউট হয়েছে। কয়েকটি লেনদেনের পরিমাণ একই এবং অল্প কয়েকটি অ্যাকাউন্ট থেকে বারবার অনুরোধ এসেছে। বড় অঙ্কের নগদ পুনরায় সরবরাহের আগে পর্যালোচনা করুন।
                            </span>
                          </div>
                        )}

                        <div className="details-section-title compact">Evidence Parameters</div>
                        <div className="evidence-grid">
                          <div>Tx ID: <span className="ev-value">#{a.evidence.transaction_id}</span></div>
                          <div>Amount: <span className="ev-value">{a.evidence.amount} BDT</span></div>
                          <div>Mean: <span className="ev-value">{a.evidence.historical_mean} BDT</span></div>
                          <div>Dev: <span className="ev-danger">+{a.evidence.amount_deviation} BDT</span></div>
                          <div>Velocity (10m): <span className="ev-value">{a.evidence.velocity_10m} tx</span></div>
                          <div>Repetition (30m): <span className="ev-value">{a.evidence.counterparty_repetition_30m} tx</span></div>
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
          <div className="ops-grid fade-in">
            {/* Left side: Case Queue list */}
            <div>
              <div className="glass-card ops-header-card">
                <h3 className="alert-panel-title">Operations Case Queue</h3>
                <div className="filter-bar">
                  <div>
                    <label className="filter-label">Status</label>
                    <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="">All Statuses</option>
                      <option value="open">Open</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="escalated">Escalated</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div>
                    <label className="filter-label">Assigned Role</label>
                    <select className="filter-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                      <option value="">All Roles</option>
                      <option value="provider_ops">Provider Operations</option>
                      <option value="field_officer">Field Officer</option>
                      <option value="risk_analyst">Risk Analyst</option>
                    </select>
                  </div>

                  <div className="acting-as-container">
                    <div className="acting-as-label">Acting As: </div>
                    <select 
                      className="filter-select acting-as-select"
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

              {/* Loading state for cases */}
              {loading && cases.length === 0 && (
                <div className="loading-container">
                  <div className="loading-spinner" />
                  <span className="loading-text">Loading data...</span>
                </div>
              )}

              {cases.length === 0 && !loading ? (
                <div className="glass-card empty-state-card">
                  <p className="empty-state-text">No active cases match the current filters.</p>
                </div>
              ) : (
                <div className="case-queue-list">
                  {cases.map(c => (
                    <div 
                      key={c.id} 
                      className={`case-card ${selectedCaseId === c.id ? 'active' : ''}`}
                      onClick={() => setSelectedCaseId(c.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => handleKeyActivate(e, () => setSelectedCaseId(c.id))}
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
                        <div className="case-routed-text">
                          Routed To: <span className="case-routed-role">{c.assigned_role}</span>
                        </div>
                      </div>
                      
                      <div className="case-card-actions">
                        <span className={`case-card-status ${c.status}`}>{c.status}</span>
                        <div className="case-card-arrow">▶</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right side: Selected Case Detail pane */}
            <div>
              {selectedCase ? (
                <div className="glass-card details-card">
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
                    <div className="case-owner-text">
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
                        className="btn btn-secondary btn-span-full"
                        onClick={() => { setNoteType('note'); setCustomNote(''); }}
                      >
                        Add Timeline Note
                      </button>
                    </div>
                  </div>

                  {/* Action Transition Note Form */}
                  {noteType && (
                    <div className="note-input-container">
                      <div className="note-header">
                        <span className="note-action-label">
                          Confirm {noteType} action
                        </span>
                        <button className="note-close-btn" onClick={() => setNoteType('')}>✕</button>
                      </div>
                      <textarea
                        className="input-textarea"
                        placeholder={`Write the details of the ${noteType}...`}
                        value={customNote}
                        onChange={e => setCustomNote(e.target.value)}
                        aria-label="Note details"
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
                <div className="glass-card empty-state-card">
                  <p className="empty-state-text">Select a case from the queue to view details and coordinate.</p>
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
