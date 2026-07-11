import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8080';

const getTrendData = (agentCode, hours = 2) => {
  const numPoints = 6;
  const labels = [];
  for (let i = numPoints - 1; i >= 0; i--) {
    if (i === 0) {
      labels.push('Now');
    } else {
      const val = (hours * i) / (numPoints - 1);
      if (hours <= 2) {
        labels.push(`${Math.round(val * 60)}m ago`);
      } else {
        labels.push(`${val.toFixed(1)}h ago`);
      }
    }
  }

  let baseCash = 120000;
  let baseBkash = 75000;
  let baseNagad = 65000;
  let baseRocket = 55000;

  if (agentCode === 'A001') {
    baseCash = 150000;
    baseBkash = 45000;
    baseNagad = 80000;
    baseRocket = 60000;
  } else if (agentCode === 'A002') {
    baseCash = 80000;
    baseBkash = 120000;
    baseNagad = 90000;
    baseRocket = 40000;
  } else if (agentCode === 'A003') {
    baseCash = 100000;
    baseBkash = 40000;
    baseNagad = 45000;
    baseRocket = 80000;
  }

  return Array.from({ length: numPoints }).map((_, index) => {
    const fraction = index / (numPoints - 1);
    let cash = baseCash;
    let bkash = baseBkash;
    let nagad = baseNagad;
    let rocket = baseRocket;

    if (agentCode === 'A001') {
      bkash = Math.round(baseBkash - fraction * 40000);
    } else if (agentCode === 'A002') {
      cash = Math.round(baseCash - fraction * 72000);
    }

    if (agentCode !== 'A001') bkash = Math.round(baseBkash + (Math.sin(index) * 2000));
    if (agentCode !== 'A002') cash = Math.round(baseCash + (Math.cos(index) * 3000));
    nagad = Math.round(baseNagad + (Math.sin(index * 1.5) * 1500));
    rocket = Math.round(baseRocket + (Math.cos(index * 2) * 1000));

    return {
      label: labels[index],
      cash: Math.max(0, cash),
      bkash: Math.max(0, bkash),
      nagad: Math.max(0, nagad),
      rocket: Math.max(0, rocket)
    };
  });
};

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

  const [showAgentInfoModal, setShowAgentInfoModal] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  // Trend graph visualizer interactive states
  const [trendHours, setTrendHours] = useState(2);
  const [trendProviders, setTrendProviders] = useState(['cash', 'bkash', 'nagad', 'rocket']);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Escape key to close modals
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setShowMetrics(false);
        setShowAgentInfoModal(false);
        setShowActionsDropdown(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

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
        <div className="header-brand-row">
          <div className="logo-container">
            <div className="logo-icon">Ω</div>
            <div>
              <h1 className="logo-text">SUPER-AGENT</h1>
              <span className="logo-subtitle">
                MULTI-PROVIDER COORDINATION PORTAL
              </span>
            </div>
          </div>

          <div className="header-actions-mobile">
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowActionsDropdown(!showActionsDropdown)}
              aria-expanded={showActionsDropdown}
              aria-label="Toggle Actions Menu"
            >
              ⚙️ Tools
            </button>
            {showActionsDropdown && (
              <div className="glass-card header-dropdown-menu" onClick={e => e.stopPropagation()}>
                <button className="btn btn-secondary header-dropdown-btn" onClick={() => { setShowActionsDropdown(false); fetchValidationMetrics(); }}>
                  Validation Metrics
                </button>
                <button className="btn btn-primary header-dropdown-btn" onClick={() => { setShowActionsDropdown(false); triggerSeed(); }} disabled={loading}>
                  Reset / Seed Data
                </button>
              </div>
            )}
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
        <div className="header-actions-desktop">
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

        {/* Agent Info Modal (Mobile View details) */}
        {showAgentInfoModal && agentOverview && (
          <div 
            className="modal-overlay" 
            role="dialog" 
            aria-modal="true" 
            aria-label="Agent Location Info"
            onClick={() => setShowAgentInfoModal(false)}
          >
            <div className="glass-card modal-content modal-content-compact" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="details-title">Agent Details</h3>
                <button className="btn btn-secondary" onClick={() => setShowAgentInfoModal(false)}>Close</button>
              </div>
              <div className="agent-info-card agent-info-card-modal">
                <div>
                  <div className="agent-info-title">Agent Code & Name</div>
                  <div className="agent-info-name agent-info-name-modal">
                    {agentOverview.agent_code} - {
                      agentOverview.agent_code === 'A001' ? 'Sajib Telecom' : 
                      agentOverview.agent_code === 'A002' ? 'Mayer Doa Enterprise' :
                      agentOverview.agent_code === 'A003' ? 'Riyad Variety Store' : 'Bismillah Store'
                    }
                  </div>
                </div>
                <div className="agent-info-location-group-modal">
                  <div className="agent-info-title">Location</div>
                  <div className="agent-info-location agent-info-location-modal">
                    📍 {agentOverview.area}, {agentOverview.thana}, {agentOverview.district}
                  </div>
                </div>
                <div className="agent-info-warning agent-info-warning-modal">
                  🚨 Provider boundaries strictly maintained. Balances never auto-settled or converted.
                </div>
              </div>
            </div>
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
              {/* Mobile-only Agent Selector and Info Button */}
              <div className="sidebar-mobile glass-card">
                <div className="mobile-selector-container">
                  <div className="mobile-selector-group">
                    <label className="agent-selector-title" style={{ margin: 0 }}>Active Agent</label>
                    <select 
                      className="mobile-select-element"
                      value={selectedAgentId} 
                      onChange={e => setSelectedAgentId(Number(e.target.value))}
                    >
                      {agentsList.map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    className="btn btn-secondary mobile-info-btn" 
                    onClick={() => setShowAgentInfoModal(true)}
                  >
                    ℹ️ Info
                  </button>
                </div>
              </div>

              {/* Desktop-only Agent Selector */}
              <div className="sidebar-desktop">
                <div className="glass-card" style={{ marginBottom: '1rem' }}>
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

                  {/* Wallet & Cash Trend Chart */}
                  <div className="glass-card trend-visualizer-card" style={{ marginTop: '1.5rem' }}>
                    <div className="trend-visualizer-header">
                      <h3 className="trend-visualizer-title">
                        📈 {trendHours}-Hour Liquidity Trend Visualizer
                      </h3>
                      
                      {/* Hours Filter Toggles */}
                      <div className="trend-filter-group">
                        <span className="trend-filter-label">Time Range:</span>
                        <div className="btn-group-toggle">
                          {[2, 6, 12, 24].map(h => (
                            <button
                              key={h}
                              className={`toggle-btn-small ${trendHours === h ? 'active' : ''}`}
                              onClick={() => {
                                setTrendHours(h);
                                setHoveredPoint(null);
                              }}
                            >
                              {h}h
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Providers Filter Group */}
                    <div className="trend-filter-group" style={{ margin: '0.25rem 0 0.75rem' }}>
                      <span className="trend-filter-label">Providers:</span>
                      <div className="provider-tags-group">
                        {[
                          { key: 'cash', name: 'Shared Cash', color: '#3B82F6' },
                          { key: 'bkash', name: 'bKash', color: '#e2125a' },
                          { key: 'nagad', name: 'Nagad', color: '#f37021' },
                          { key: 'rocket', name: 'Rocket', color: '#8c2d82' }
                        ].map(p => {
                          const isVisible = trendProviders.includes(p.key);
                          return (
                            <button
                              key={p.key}
                              className={`provider-tag-btn ${isVisible ? 'active' : ''}`}
                              style={{
                                borderColor: isVisible ? p.color : 'rgba(255,255,255,0.15)',
                                background: isVisible ? `rgba(${p.key === 'cash' ? '59,130,246' : p.key === 'bkash' ? '226,18,90' : p.key === 'nagad' ? '243,112,33' : '140,45,130'}, 0.15)` : 'transparent',
                                color: isVisible ? '#fff' : 'var(--text-secondary)'
                              }}
                              onClick={() => {
                                if (isVisible) {
                                  if (trendProviders.length > 1) {
                                    setTrendProviders(trendProviders.filter(k => k !== p.key));
                                    setHoveredPoint(null);
                                  }
                                } else {
                                  setTrendProviders([...trendProviders, p.key]);
                                  setHoveredPoint(null);
                                }
                              }}
                            >
                              <span className="provider-tag-indicator" style={{ backgroundColor: p.color }}></span>
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hover Detail Bar */}
                    {hoveredPoint ? (
                      <div className="trend-hover-details-bar fade-in">
                        <span className="trend-hover-time">🕒 {hoveredPoint.label}</span>
                        <div className="trend-hover-values">
                          {trendProviders.includes('cash') && (
                            <span className="trend-hover-val-item text-cash">
                              Cash: <strong>{hoveredPoint.cash.toLocaleString()} BDT</strong>
                            </span>
                          )}
                          {trendProviders.includes('bkash') && (
                            <span className="trend-hover-val-item text-bkash">
                              bKash: <strong>{hoveredPoint.bkash.toLocaleString()} BDT</strong>
                            </span>
                          )}
                          {trendProviders.includes('nagad') && (
                            <span className="trend-hover-val-item text-nagad">
                              Nagad: <strong>{hoveredPoint.nagad.toLocaleString()} BDT</strong>
                            </span>
                          )}
                          {trendProviders.includes('rocket') && (
                            <span className="trend-hover-val-item text-rocket">
                              Rocket: <strong>{hoveredPoint.rocket.toLocaleString()} BDT</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="trend-hover-details-placeholder">
                        💡 Hover over the graph points to see detailed BDT balance readings.
                      </div>
                    )}

                    <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                      <svg viewBox="0 0 600 220" width="100%" height="100%" style={{ overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="bkashGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e2125a" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#e2125a" stopOpacity="0.0" />
                          </linearGradient>
                          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="40" y1="30" x2="560" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                        <line x1="40" y1="100" x2="560" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                        <line x1="40" y1="170" x2="560" y2="170" stroke="rgba(255,255,255,0.08)" />

                        {(() => {
                          const points = getTrendData(agentOverview.agent_code, trendHours);
                          const maxVal = agentOverview.agent_code === 'A001' ? 160000 : 130000;
                          
                          const getCoords = (key) => points.map((p, idx) => {
                            const x = 40 + idx * 104;
                            const y = 170 - (p[key] / maxVal) * 130;
                            return { x, y, val: p[key] };
                          });

                          const cashCoords = getCoords('cash');
                          const bkashCoords = getCoords('bkash');
                          const nagadCoords = getCoords('nagad');
                          const rocketCoords = getCoords('rocket');

                          const makePath = (coords) => coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                          const makeAreaPath = (coords) => `${makePath(coords)} L ${coords[coords.length - 1].x} 170 L ${coords[0].x} 170 Z`;

                          return (
                            <>
                              {/* Area Fills */}
                              {trendProviders.includes('bkash') && agentOverview.agent_code === 'A001' && (
                                <path d={makeAreaPath(bkashCoords)} fill="url(#bkashGrad)" pointerEvents="none" />
                              )}
                              {trendProviders.includes('cash') && agentOverview.agent_code === 'A002' && (
                                <path d={makeAreaPath(cashCoords)} fill="url(#cashGrad)" pointerEvents="none" />
                              )}

                              {/* Trend Lines */}
                              {trendProviders.includes('cash') && (
                                <path d={makePath(cashCoords)} fill="none" stroke="#3B82F6" strokeWidth="2.5" pointerEvents="none" />
                              )}
                              {trendProviders.includes('bkash') && (
                                <path d={makePath(bkashCoords)} fill="none" stroke="#e2125a" strokeWidth="2" strokeDasharray={agentOverview.agent_code === 'A001' ? "0" : "3"} pointerEvents="none" />
                              )}
                              {trendProviders.includes('nagad') && (
                                <path d={makePath(nagadCoords)} fill="none" stroke="#f37021" strokeWidth="2" strokeDasharray="3" pointerEvents="none" />
                              )}
                              {trendProviders.includes('rocket') && (
                                <path d={makePath(rocketCoords)} fill="none" stroke="#8c2d82" strokeWidth="2" strokeDasharray="3" pointerEvents="none" />
                              )}

                              {/* Dotted Vertical Hover Guide */}
                              {hoveredPoint && (
                                <line 
                                  x1={hoveredPoint.x} 
                                  y1={10} 
                                  x2={hoveredPoint.x} 
                                  y2={170} 
                                  stroke="rgba(255, 255, 255, 0.25)" 
                                  strokeDasharray="2" 
                                  pointerEvents="none" 
                                />
                              )}

                              {/* Static Points / Highlight Circles */}
                              {points.map((p, idx) => {
                                const cc = cashCoords[idx];
                                const bc = bkashCoords[idx];
                                const nc = nagadCoords[idx];
                                const rc = rocketCoords[idx];
                                const isHovered = hoveredPoint && hoveredPoint.label === p.label;

                                return (
                                  <g key={idx}>
                                    <text x={cc.x} y="192" fill="var(--text-secondary)" fontSize="10" textAnchor="middle">{p.label}</text>
                                    
                                    {/* Default data circles for key scenarios */}
                                    {!hoveredPoint && trendProviders.includes('cash') && agentOverview.agent_code === 'A002' && (
                                      <circle cx={cc.x} cy={cc.y} r="4" fill="#3B82F6" stroke="#fff" strokeWidth="1" pointerEvents="none" />
                                    )}
                                    {!hoveredPoint && trendProviders.includes('bkash') && agentOverview.agent_code === 'A001' && (
                                      <circle cx={bc.x} cy={bc.y} r="4" fill="#e2125a" stroke="#fff" strokeWidth="1" pointerEvents="none" />
                                    )}

                                    {/* Dynamic Highlight Circles on Hover */}
                                    {isHovered && trendProviders.includes('cash') && (
                                      <circle cx={cc.x} cy={cc.y} r="6" fill="#3B82F6" stroke="#fff" strokeWidth="2" pointerEvents="none" />
                                    )}
                                    {isHovered && trendProviders.includes('bkash') && (
                                      <circle cx={bc.x} cy={bc.y} r="6" fill="#e2125a" stroke="#fff" strokeWidth="2" pointerEvents="none" />
                                    )}
                                    {isHovered && trendProviders.includes('nagad') && (
                                      <circle cx={nc.x} cy={nc.y} r="6" fill="#f37021" stroke="#fff" strokeWidth="2" pointerEvents="none" />
                                    )}
                                    {isHovered && trendProviders.includes('rocket') && (
                                      <circle cx={rc.x} cy={rc.y} r="6" fill="#8c2d82" stroke="#fff" strokeWidth="2" pointerEvents="none" />
                                    )}
                                  </g>
                                );
                              })}

                              {/* Static Scenario Labels (only shown when not hovering for cleaner look) */}
                              {!hoveredPoint && (
                                <>
                                  {trendProviders.includes('bkash') && (
                                    <>
                                      <text x={bkashCoords[0].x + 5} y={bkashCoords[0].y - 5} fill="#e2125a" fontSize="9" fontWeight="bold">
                                        {agentOverview.agent_code === 'A001' ? 'bkash: 45k' : ''}
                                      </text>
                                      <text x={bkashCoords[5].x - 5} y={bkashCoords[5].y - 8} fill="#e2125a" fontSize="9" fontWeight="bold" textAnchor="end">
                                        {agentOverview.agent_code === 'A001' ? 'DEPLETED: 5k BDT' : ''}
                                      </text>
                                    </>
                                  )}
                                  {trendProviders.includes('cash') && (
                                    <>
                                      <text x={cashCoords[0].x + 5} y={cashCoords[0].y - 5} fill="#3B82F6" fontSize="9" fontWeight="bold">
                                        {agentOverview.agent_code === 'A002' ? 'Cash Box: 80k' : ''}
                                      </text>
                                      <text x={cashCoords[5].x - 5} y={cashCoords[5].y - 8} fill="#3B82F6" fontSize="9" fontWeight="bold" textAnchor="end">
                                        {agentOverview.agent_code === 'A002' ? 'DEPLETED: 8k BDT' : ''}
                                      </text>
                                    </>
                                  )}
                                </>
                              )}

                              {/* Invisible interactive column trigger rects */}
                              {points.map((p, idx) => {
                                const x = 40 + idx * 104;
                                return (
                                  <rect
                                    key={`hover-col-${idx}`}
                                    x={x - 52}
                                    y={10}
                                    width={104}
                                    height={180}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setHoveredPoint({
                                      x,
                                      label: p.label,
                                      cash: p.cash,
                                      bkash: p.bkash,
                                      nagad: p.nagad,
                                      rocket: p.rocket
                                    })}
                                    onMouseMove={() => setHoveredPoint({
                                      x,
                                      label: p.label,
                                      cash: p.cash,
                                      bkash: p.bkash,
                                      nagad: p.nagad,
                                      rocket: p.rocket
                                    })}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                  />
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>

                    </div>
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

                  {agentForecasts && agentForecasts.forecasts && (
                    <div className="scrollable-alerts-container">
                      {agentForecasts.forecasts.map((f, i) => {
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

                            {/* Trilingual AI Alerts (English, Bangla, Banglish) */}
                            {hasRisk && (
                              <div className="alert-msg-bilingual">
                                <span className="alert-msg-en">🇬🇧 {f.reason_en}</span>
                                {f.reason_bn && (
                                  <span className="alert-msg-bn">🇧🇩 {f.reason_bn}</span>
                                )}
                                {f.reason_banglish && (
                                  <span className="alert-msg-banglish">🗣️ {f.reason_banglish}</span>
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
                  )}
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
                    <div className="scrollable-alerts-container">
                      {agentAnomalies.map((a, i) => (
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

                          {/* Trilingual AI Alerts (English, Bangla, Banglish) */}
                          <div className="alert-msg-bilingual" style={{ borderLeftColor: 'var(--color-danger)' }}>
                            <span className="alert-msg-en">🇬🇧 {a.reason_en}</span>
                            {a.reason_bn && (
                              <span className="alert-msg-bn">🇧🇩 {a.reason_bn}</span>
                            )}
                            {a.reason_banglish && (
                              <span className="alert-msg-banglish">🗣️ {a.reason_banglish}</span>
                            )}
                          </div>

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
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Ops Control Room (Cases) */}
        {activeTab === 'ops' && (
          <div className="ops-grid fade-in">
            <div>
              <div className="glass-card ops-header-card">
                <h3 className="alert-panel-title">Operations Case Queue</h3>
                {cases.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem' }}>
                      {(() => {
                        const total = cases.length;
                        const open = cases.filter(c => c.status === 'open').length;
                        const ack = cases.filter(c => c.status === 'acknowledged').length;
                        const esc = cases.filter(c => c.status === 'escalated').length;
                        const res = cases.filter(c => c.status === 'resolved').length;
                        
                        return (
                          <>
                            <div style={{ width: `${(open/total)*100}%`, background: '#60A5FA' }} title={`Open: ${open}`} />
                            <div style={{ width: `${(ack/total)*100}%`, background: '#F59E0B' }} title={`Acknowledged: ${ack}`} />
                            <div style={{ width: `${(esc/total)*100}%`, background: '#F87171' }} title={`Escalated: ${esc}`} />
                            <div style={{ width: `${(res/total)*100}%`, background: '#34D399' }} title={`Resolved: ${res}`} />
                          </>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#60A5FA' }}></span> Open ({cases.filter(c => c.status === 'open').length})
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }}></span> Ack ({cases.filter(c => c.status === 'acknowledged').length})
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#F87171' }}></span> Esc ({cases.filter(c => c.status === 'escalated').length})
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#34D399' }}></span> Res ({cases.filter(c => c.status === 'resolved').length})
                      </span>
                    </div>
                  </div>
                )}
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
