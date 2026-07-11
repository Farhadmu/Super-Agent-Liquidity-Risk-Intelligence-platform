import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

// Theme management
const getInitialTheme = () => {
  try {
    const saved = window.localStorage.getItem('superAgentTheme');
    if (saved) return saved;
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Global tooltip handlers to avoid nested component unmounting on state change
const globalTooltip = {
  show: () => {},
  hide: () => {}
};

const HelpDot = ({ text }) => (
  <span
    className="help-dot"
    tabIndex={0}
    aria-label={text}
    onMouseEnter={e => globalTooltip.show(text, e.currentTarget)}
    onFocus={e => globalTooltip.show(text, e.currentTarget)}
    onMouseLeave={() => globalTooltip.hide()}
    onBlur={() => globalTooltip.hide()}
  >
    ?
  </span>
);

const AGENTS_LIST = [
  { id: 1, code: 'A001', name: 'Sajib Telecom (Dhaka)' },
  { id: 2, code: 'A002', name: 'Mayer Doa Enterprise (Chittagong)' },
  { id: 3, code: 'A003', name: 'Riyad Variety Store (Sylhet)' },
  { id: 4, code: 'A004', name: 'Bismillah Store (Dhaka)' }
];

const DEMO_USERS = [
  {
    id: 'provider_ops',
    name: 'Ops Officer Amina',
    role: 'provider_ops',
    roleLabel: 'Provider Operations',
    scope: 'Provider wallet shortages',
    defaultTab: 'ops',
    username: 'amina.ops',
    password: 'demo123'
  },
  {
    id: 'risk_analyst',
    name: 'Analyst Farhan',
    role: 'risk_analyst',
    roleLabel: 'Risk Analyst',
    scope: 'Behavioral anomaly review',
    defaultTab: 'ops',
    username: 'farhan.risk',
    password: 'demo123'
  },
  {
    id: 'field_officer',
    name: 'Territory Officer Tanvir',
    role: 'field_officer',
    roleLabel: 'Field Officer',
    scope: 'Shared cash coordination',
    defaultTab: 'ops',
    username: 'tanvir.field',
    password: 'demo123'
  },
  {
    id: 'management',
    name: 'Management Lead Nusrat',
    role: 'management',
    roleLabel: 'Management',
    scope: 'Oversight, validation metrics, all cases',
    defaultTab: 'ops',
    username: 'nusrat.mgmt',
    password: 'demo123'
  },
  {
    id: 'super_agent',
    name: 'Sajib Telecom',
    role: 'agent',
    roleLabel: 'Super Agent',
    scope: 'Agent dashboard and local alerts',
    defaultTab: 'agent',
    agentId: 1,
    username: 'sajib.agent',
    password: 'demo123'
  },
  {
    id: 'demo_architect',
    name: 'Demo Architect (Admin)',
    role: 'admin',
    roleLabel: 'Demo Architect',
    scope: 'Create custom sandbox scenarios',
    defaultTab: 'agent',
    agentId: 1,
    username: 'admin.demo',
    password: 'demo123'
  }
];

const getSavedUser = () => {
  try {
    const savedUserId = window.localStorage.getItem('superAgentDemoUser');
    return DEMO_USERS.find(user => user.id === savedUserId) || null;
  } catch {
    return null;
  }
};

const getRoleLabel = (role) => {
  const user = DEMO_USERS.find(item => item.role === role);
  return user ? user.roleLabel : role.replace(/_/g, ' ');
};

const getTrendData = (agentOverview, hours = 2) => {
  if (!agentOverview) return [];
  const agentCode = agentOverview.agent_code;

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

  let liveCash = agentOverview.shared_cash;
  let liveBkash = 0;
  let liveNagad = 0;
  let liveRocket = 0;

  if (agentOverview.provider_balances) {
    agentOverview.provider_balances.forEach(pb => {
      const name = pb.provider_name.toLowerCase();
      if (name.includes('bkash')) {
        liveBkash = pb.balance;
      } else if (name.includes('nagad')) {
        liveNagad = pb.balance;
      } else if (name.includes('rocket')) {
        liveRocket = pb.balance;
      }
    });
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
    if (index === numPoints - 1) {
      return {
        label: 'Now',
        cash: Math.max(0, Math.round(liveCash)),
        bkash: Math.max(0, Math.round(liveBkash)),
        nagad: Math.max(0, Math.round(liveNagad)),
        rocket: Math.max(0, Math.round(liveRocket))
      };
    }

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
  const [theme, setTheme] = useState(getInitialTheme);
  const [currentUser, setCurrentUser] = useState(getSavedUser);
  const [activeTab, setActiveTab] = useState(currentUser?.defaultTab || 'agent'); // 'agent' or 'ops'
  const agentsList = AGENTS_LIST;
  const [selectedAgentId, setSelectedAgentId] = useState(currentUser?.agentId || 1);
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
  const [loginRoleId, setLoginRoleId] = useState(DEMO_USERS[0].id);
  const [loginUsername, setLoginUsername] = useState(DEMO_USERS[0].username);
  const [loginPassword, setLoginPassword] = useState(DEMO_USERS[0].password);
  const [loginError, setLoginError] = useState('');
  const [tooltip, setTooltip] = useState(null);

  // Trend graph visualizer interactive states
  const [trendHours, setTrendHours] = useState(2);
  const [trendProviders, setTrendProviders] = useState(['cash', 'bkash', 'nagad', 'rocket']);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Sandbox Scenario controls
  const [sandboxCash, setSandboxCash] = useState(120000);
  const [sandboxBkash, setSandboxBkash] = useState(75000);
  const [sandboxNagad, setSandboxNagad] = useState(65000);
  const [sandboxRocket, setSandboxRocket] = useState(55000);
  const [sandboxBkashDelayed, setSandboxBkashDelayed] = useState(false);
  const [sandboxNagadDelayed, setSandboxNagadDelayed] = useState(false);
  const [sandboxRocketDelayed, setSandboxRocketDelayed] = useState(false);
  const [sandboxInjectAnomaly, setSandboxInjectAnomaly] = useState(false);
  const [sandboxAnomalyAmount, setSandboxAnomalyAmount] = useState(9999);
  const [sandboxAnomalyCount, setSandboxAnomalyCount] = useState(5);
  const [sandboxAnomalyCounterparty, setSandboxAnomalyCounterparty] = useState('CUST_CUSTOM');
  const [sandboxAnomalyType, setSandboxAnomalyType] = useState('cash_out');
  const [sandboxMessage, setSandboxMessage] = useState('');
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [reassignTargetRole, setReassignTargetRole] = useState('provider_ops');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const actorName = currentUser?.name || 'Demo User';
  const actorRole = currentUser?.role || 'viewer';
  const selectedLoginUser = DEMO_USERS.find(user => user.id === loginRoleId) || DEMO_USERS[0];
  const isManagement = actorRole === 'management';
  const isOpsRestricted = actorRole !== 'management' && actorRole !== 'admin';
  const visibleAgents = currentUser?.role === 'agent'
    ? agentsList.filter(agent => agent.id === currentUser.agentId)
    : agentsList;
  const canManageSelectedCase = Boolean(
    selectedCase
    && currentUser
    && (selectedCase.assigned_role === actorRole || actorRole === 'admin' || actorRole === 'management')
    && selectedCase.status !== 'resolved'
  );

  // Theme toggle
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { window.localStorage.setItem('superAgentTheme', next); } catch { /* ignore */ }
      return next;
    });
  };

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const showTooltip = (text, target) => {
    const rect = target.getBoundingClientRect();
    const tooltipWidth = Math.min(240, window.innerWidth - 32);
    const x = Math.min(
      window.innerWidth - tooltipWidth / 2 - 16,
      Math.max(tooltipWidth / 2 + 16, rect.left + rect.width / 2)
    );
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showBelow = spaceAbove < 120 && spaceBelow > spaceAbove;
    const y = showBelow ? rect.bottom + 10 : rect.top - 10;
    setTooltip({ text, x, y, placement: showBelow ? 'bottom' : 'top' });
  };

  const hideTooltip = () => setTooltip(null);

  // Bind local functions to global tooltip handlers to preserve references on rerenders
  globalTooltip.show = showTooltip;
  globalTooltip.hide = hideTooltip;

  const TooltipOverlay = () => {
    if (!tooltip) return null;
    return createPortal(
      <div
        className={`app-tooltip ${tooltip.placement}`}
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        {tooltip.text}
      </div>,
      document.body
    );
  };

  const fetchAgentData = useCallback(async (id) => {
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
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      let url = `${API_BASE}/cases?`;
      if (filterStatus) url += `status=${filterStatus}&`;
      if (filterRole) url += `role=${filterRole}&`;
      
      const res = await fetch(url);
      const data = await res.json();
      setCases(data);
      if (data.length > 0) {
        setSelectedCaseId(currentId => currentId || data[0].id);
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching cases:", err);
      setError('Failed to connect to the server. Please check that the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterStatus]);

  const handleLogin = (user) => {
    try {
      window.localStorage.setItem('superAgentDemoUser', user.id);
    } catch {
      // Local storage is optional for the demo session.
    }
    setCurrentUser(user);
    setActiveTab(user.defaultTab);
    setFilterStatus('');
    setFilterRole(user.role === 'management' || user.role === 'agent' || user.role === 'admin' ? '' : user.role);
    setNoteType('');
    setCustomNote('');
    if (user.agentId) {
      setSelectedAgentId(user.agentId);
    }
  };

  const handleLoginRoleChange = (userId) => {
    const user = DEMO_USERS.find(item => item.id === userId) || DEMO_USERS[0];
    setLoginRoleId(user.id);
    setLoginUsername(user.username);
    setLoginPassword(user.password);
    setLoginError('');
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const matchedUser = DEMO_USERS.find(
      user => user.username === loginUsername.trim() && user.password === loginPassword
    );
    if (matchedUser) {
      handleLogin(matchedUser);
      return;
    }
    setLoginError('Invalid demo credentials.');
  };

  const handleLogout = () => {
    try {
      window.localStorage.removeItem('superAgentDemoUser');
    } catch {
      // Local storage is optional for the demo session.
    }
    setCurrentUser(null);
    setShowMetrics(false);
    setShowActionsDropdown(false);
    setNoteType('');
    setCustomNote('');
  };

  // Sync sandbox state when agent overview data is fetched
  useEffect(() => {
    if (agentOverview) {
      setSandboxCash(agentOverview.shared_cash);
      let bkashVal = 0, nagadVal = 0, rocketVal = 0;
      let bkashDel = false, nagadDel = false, rocketDel = false;
      if (agentOverview.provider_balances) {
        agentOverview.provider_balances.forEach(pb => {
          const name = pb.provider_name.toLowerCase();
          if (name.includes('bkash')) {
            bkashVal = pb.balance;
            bkashDel = pb.is_delayed;
          } else if (name.includes('nagad')) {
            nagadVal = pb.balance;
            nagadDel = pb.is_delayed;
          } else if (name.includes('rocket')) {
            rocketVal = pb.balance;
            rocketDel = pb.is_delayed;
          }
        });
      }
      setSandboxBkash(bkashVal);
      setSandboxNagad(nagadVal);
      setSandboxRocket(rocketVal);
      setSandboxBkashDelayed(bkashDel);
      setSandboxNagadDelayed(nagadDel);
      setSandboxRocketDelayed(rocketDel);
    }
  }, [agentOverview]);

  const handleApplyCustomScenario = async () => {
    setSandboxLoading(true);
    setSandboxMessage('');
    try {
      const res = await fetch(`${API_BASE}/simulate/custom-scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: selectedAgentId,
          shared_cash: Number(sandboxCash),
          bkash_balance: Number(sandboxBkash),
          nagad_balance: Number(sandboxNagad),
          rocket_balance: Number(sandboxRocket),
          bkash_delayed: sandboxBkashDelayed,
          nagad_delayed: sandboxNagadDelayed,
          rocket_delayed: sandboxRocketDelayed,
          inject_anomaly: sandboxInjectAnomaly,
          anomaly_amount: Number(sandboxAnomalyAmount),
          anomaly_count: Number(sandboxAnomalyCount),
          anomaly_counterparty: sandboxAnomalyCounterparty,
          anomaly_type: sandboxAnomalyType
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSandboxMessage(`✅ Success: ${data.message}`);
        // Fetch new data
        fetchAgentData(selectedAgentId);
      } else {
        setSandboxMessage(`❌ Error: ${data.detail || 'Could not apply scenario'}`);
      }
    } catch (err) {
      setSandboxMessage(`❌ Error: ${err.message}`);
    } finally {
      setSandboxLoading(false);
    }
  };

  // Escape key and scroll handler to dismiss overlays
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setShowMetrics(false);
        setShowAgentInfoModal(false);
        setShowActionsDropdown(false);
      }
    };
    const handleScroll = () => {
      hideTooltip();
    };
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  // Fetch Agent Data
  useEffect(() => {
    if (activeTab === 'agent' && selectedAgentId) {
      fetchAgentData(selectedAgentId);
    }
  }, [selectedAgentId, activeTab, fetchAgentData]);

  // Fetch Cases Data
  useEffect(() => {
    if (activeTab === 'ops') {
      fetchCases();
    }
  }, [activeTab, fetchCases]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'management' || currentUser.role === 'agent' || currentUser.role === 'admin') {
      setFilterRole('');
    } else {
      setFilterRole(currentUser.role);
    }
  }, [currentUser]);

  // Sync selected case details when list changes
  useEffect(() => {
    if (selectedCaseId && cases.length > 0) {
      const match = cases.find(c => c.id === selectedCaseId);
      if (match) setSelectedCase(match);
    } else {
      setSelectedCase(null);
    }
  }, [selectedCaseId, cases]);

  useEffect(() => {
    setNoteType('');
    setCustomNote('');
  }, [selectedCaseId, currentUser]);

  useEffect(() => {
    if (selectedCase) {
      setReassignTargetRole(selectedCase.assigned_role);
    }
  }, [selectedCase]);

  // Real-time SSE updates listener
  useEffect(() => {
    let sseUrl = `${API_BASE}/api/stream`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener("case_update", (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("[SSE case_update]:", payload);
        fetchCases();
      } catch (err) {
        console.error("Error parsing case_update event:", err);
      }
    });

    eventSource.addEventListener("scenario_update", (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("[SSE scenario_update]:", payload);
        if (selectedAgentId) fetchAgentData(selectedAgentId);
        fetchCases();
      } catch (err) {
        console.error("Error parsing scenario_update event:", err);
      }
    });

    eventSource.addEventListener("data_reset", (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("[SSE data_reset]:", payload);
        if (selectedAgentId) fetchAgentData(selectedAgentId);
        fetchCases();
      } catch (err) {
        console.error("Error parsing data_reset event:", err);
      }
    });

    eventSource.onerror = (err) => {
      console.error("[SSE Error]:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [selectedAgentId, fetchAgentData, fetchCases]);

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
    if (!canManageSelectedCase) return;
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
    if (!canManageSelectedCase) return;
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

  const handleReassignCase = async (caseId, newRole, note) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/cases/${caseId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor_role: actorRole,
          new_role: newRole,
          note: note || "No comments provided."
        })
      });
      if (res.ok) {
        // Refresh cases
        await fetchCases();
        
        // Refresh selected case details
        const overviewRes = await fetch(`${API_BASE}/cases`);
        const data = await overviewRes.json();
        const updated = data.find(c => c.id === caseId);
        if (updated) setSelectedCase(updated);
      } else {
        const data = await res.json();
        alert(`Error: ${data.detail || 'Could not reassign case'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyActivate = (e, callback) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  };

  if (!currentUser) {
    return (
      <main className="login-shell">
        <TooltipOverlay />

        {/* Theme toggle fixed on screen */}
        <button
          className="theme-toggle-btn login-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <section className="login-panel fade-in">
          <div className="login-layout">
            {/* LEFT: Form */}
            <div className="login-form-column">
              <div className="login-brand">
                <div className="logo-icon" aria-hidden="true">Ω</div>
                <div>
                  <div className="login-brand-title">SUPER-AGENT</div>
                  <div className="login-brand-sub">Multi-Provider Liquidity Platform</div>
                </div>
              </div>

              <div className="login-intro">
                <h2>Welcome Back</h2>
                <p>
                  Role-based demo access&nbsp;
                  <HelpDot text="Each demo account opens the portal with role-specific case access and full audit identity." />
                </p>
              </div>

              <form className="login-form" onSubmit={handleLoginSubmit} noValidate>
                <label className="login-field">
                  <span>Select Role</span>
                  <select
                    value={loginRoleId}
                    onChange={e => handleLoginRoleChange(e.target.value)}
                    aria-label="Select demo role"
                  >
                    {DEMO_USERS.filter(user => user.role !== 'admin').map(user => (
                      <option key={user.id} value={user.id}>{user.roleLabel} — {user.name}</option>
                    ))}
                  </select>
                </label>

                <label className="login-field">
                  <span>Username</span>
                  <input
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="Enter username"
                    aria-label="Username"
                  />
                </label>

                <label className="login-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    aria-label="Password"
                  />
                </label>

                {loginError && (
                  <div className="login-error" role="alert">
                    <span>⚠️</span> {loginError}
                  </div>
                )}

                <button className="btn btn-primary login-submit-btn" type="submit">
                  Enter Dashboard →
                </button>
              </form>

              <div className="login-credential-strip" aria-label="Demo credentials">
                <span>Username</span>
                <strong>{selectedLoginUser.username}</strong>
                <span>Password</span>
                <strong>{selectedLoginUser.password}</strong>
              </div>
            </div>

            {/* RIGHT: Role picker */}
            <div className="login-role-column">
              <div className="login-selected-preview" aria-live="polite">
                <span className="login-role-label">{selectedLoginUser.roleLabel}</span>
                <strong>{selectedLoginUser.name}</strong>
                <p>{selectedLoginUser.scope}</p>
                <div className="login-preview-grid">
                  <div>
                    <span>Default View</span>
                    <strong>{selectedLoginUser.defaultTab === 'ops' ? 'Ops Control Room' : 'Agent Dashboard'}</strong>
                  </div>
                  <div>
                    <span>Permission Level</span>
                    <strong>
                      {selectedLoginUser.role === 'management' ? 'Read-only oversight' : selectedLoginUser.role === 'agent' ? 'Own dashboard only' : 'Routed cases only'}
                      <HelpDot text={selectedLoginUser.role === 'management' ? 'Management can review all cases and metrics, but cannot change case status.' : selectedLoginUser.role === 'agent' ? 'Agent view is scoped to the selected super agent dashboard.' : 'This role can act only on cases routed to its queue.'} />
                    </strong>
                  </div>
                </div>
              </div>

              <div>
                <p className="login-role-section-title">Choose a demo role to explore</p>
                <div className="login-role-grid" role="listbox" aria-label="Demo roles">
                  {DEMO_USERS.filter(user => user.role !== 'admin').map(user => (
                    <button
                      key={user.id}
                      className={`login-role-card ${loginRoleId === user.id ? 'active' : ''}`}
                      onClick={() => handleLoginRoleChange(user.id)}
                      type="button"
                      role="option"
                      aria-selected={loginRoleId === user.id}
                    >
                      <span className="login-role-label">{user.roleLabel}</span>
                      <span className="login-role-name">{user.name}</span>
                      <span className="login-role-scope">
                        {user.defaultTab === 'ops' ? '🖥 Ops View' : '📊 Agent View'}
                        &nbsp;<HelpDot text={user.scope} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <TooltipOverlay />
      <header role="banner">
        {/* Brand Logo - Left */}
        <div className="logo-container">
          <div className="logo-icon" aria-hidden="true">Ω</div>
          <div>
            <h1 className="logo-text">SUPER-AGENT</h1>
            <span className="logo-subtitle">Multi-Provider Coordination</span>
          </div>
        </div>

        {/* Tab toggles — center */}
        <div className="view-toggle" role="tablist" aria-label="Main navigation">
          <button
            className={`toggle-btn ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => { setActiveTab('agent'); setMobileDetailOpen(false); }}
            role="tab"
            aria-selected={activeTab === 'agent'}
            id="tab-agent"
          >
            📊 Agent Dashboard
          </button>
          <button
            className={`toggle-btn ${activeTab === 'ops' ? 'active' : ''}`}
            onClick={() => currentUser.role !== 'agent' && setActiveTab('ops')}
            disabled={currentUser.role === 'agent'}
            role="tab"
            aria-selected={activeTab === 'ops'}
            id="tab-ops"
            title={currentUser.role === 'agent' ? 'Ops Control Room is not available for this role' : ''}
          >
            🖥 Ops Control Room
          </button>
        </div>

        {/* Right side header actions: Theme Toggle + Profile dropdown avatar */}
        <div className="header-right-actions">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          
          {/* Profile Dropdown Avatar */}
          <div className="profile-dropdown-container">
            <div className="profile-avatar-trigger" tabIndex={0} aria-label="User Profile details">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            
            <div className="profile-dropdown-menu">
              <div className="profile-menu-header">
                <div className="profile-menu-avatar">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-menu-info">
                  <div className="profile-menu-name">{currentUser.name}</div>
                  <div className="profile-menu-role">{currentUser.roleLabel}</div>
                </div>
              </div>
              
              <div className="profile-menu-divider" />
              
              <div className="profile-menu-actions">
                {isManagement && (
                  <button 
                    className="btn btn-secondary profile-action-btn" 
                    onClick={fetchValidationMetrics}
                  >
                    📊 Metrics Report
                  </button>
                )}
                <button 
                  className="btn btn-primary profile-action-btn" 
                  onClick={triggerSeed} 
                  disabled={loading}
                >
                  {loading ? '⏳ Loading...' : '🔄 Reset / Seed Data'}
                </button>
                <button 
                  className="btn btn-secondary profile-action-btn" 
                  onClick={handleLogout}
                >
                  ↩ Switch User Role
                </button>
              </div>
            </div>
          </div>
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
            <button
              className="btn btn-primary"
              onClick={() => {
                setError(null);
                if (activeTab === 'agent') {
                  fetchAgentData(selectedAgentId);
                } else {
                  fetchCases();
                }
              }}
            >
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
                    {metrics.liquidity_forecasting.context}
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
          <div className="agent-grid fade-in" role="tabpanel" aria-labelledby="tab-agent">
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
                      {visibleAgents.map(a => (
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
                    {visibleAgents.map(a => (
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
                  {currentUser?.role === 'admin' && (
                    <div className="glass-card sandbox-panel" style={{ marginBottom: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <div className="sandbox-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                          🛠️ Scenario Architect Sandbox
                        </h3>
                        <span className="badge-provider" style={{ backgroundColor: '#10B981', color: '#fff', fontSize: '0.7rem' }}>ADMIN ROLE</span>
                      </div>
                      
                      <div className="sandbox-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                        <div className="sandbox-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Shared Cash (BDT)</label>
                          <input 
                            type="number" 
                            className="mobile-select-element" 
                            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}
                            value={sandboxCash} 
                            onChange={e => setSandboxCash(Number(e.target.value))} 
                          />
                        </div>

                        <div className="sandbox-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>bKash Balance (BDT)</label>
                          <input 
                            type="number" 
                            className="mobile-select-element" 
                            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}
                            value={sandboxBkash} 
                            onChange={e => setSandboxBkash(Number(e.target.value))} 
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '0.2rem' }}>
                            <input type="checkbox" checked={sandboxBkashDelayed} onChange={e => setSandboxBkashDelayed(e.target.checked)} />
                            Feed Delay (3h)
                          </label>
                        </div>

                        <div className="sandbox-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Nagad Balance (BDT)</label>
                          <input 
                            type="number" 
                            className="mobile-select-element" 
                            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}
                            value={sandboxNagad} 
                            onChange={e => setSandboxNagad(Number(e.target.value))} 
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '0.2rem' }}>
                            <input type="checkbox" checked={sandboxNagadDelayed} onChange={e => setSandboxNagadDelayed(e.target.checked)} />
                            Feed Delay (3h)
                          </label>
                        </div>

                        <div className="sandbox-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Rocket Balance (BDT)</label>
                          <input 
                            type="number" 
                            className="mobile-select-element" 
                            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}
                            value={sandboxRocket} 
                            onChange={e => setSandboxRocket(Number(e.target.value))} 
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '0.2rem' }}>
                            <input type="checkbox" checked={sandboxRocketDelayed} onChange={e => setSandboxRocketDelayed(e.target.checked)} />
                            Feed Delay (3h)
                          </label>
                        </div>
                      </div>

                      <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700', color: '#fff', cursor: 'pointer' }}>
                          <input type="checkbox" checked={sandboxInjectAnomaly} onChange={e => setSandboxInjectAnomaly(e.target.checked)} />
                          ⚡ Inject transaction velocity burst (ML Anomaly Trigger)
                        </label>
                        
                        {sandboxInjectAnomaly && (
                          <div className="sandbox-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '0.5rem' }}>
                            <div className="sandbox-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Tx Amount (BDT)</label>
                              <input 
                                type="number" 
                                className="mobile-select-element" 
                                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.35rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.8rem' }}
                                value={sandboxAnomalyAmount} 
                                onChange={e => setSandboxAnomalyAmount(Number(e.target.value))} 
                              />
                            </div>
                            <div className="sandbox-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Tx Count (Burst Size)</label>
                              <input 
                                type="number" 
                                className="mobile-select-element" 
                                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.35rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.8rem' }}
                                value={sandboxAnomalyCount} 
                                onChange={e => setSandboxAnomalyCount(Number(e.target.value))} 
                              />
                            </div>
                            <div className="sandbox-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Counterparty Ref</label>
                              <input 
                                type="text" 
                                className="mobile-select-element" 
                                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.35rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.8rem' }}
                                value={sandboxAnomalyCounterparty} 
                                onChange={e => setSandboxAnomalyCounterparty(e.target.value)} 
                              />
                            </div>
                            <div className="sandbox-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Transaction Type</label>
                              <select 
                                className="mobile-select-element" 
                                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.35rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.8rem' }}
                                value={sandboxAnomalyType} 
                                onChange={e => setSandboxAnomalyType(e.target.value)}
                              >
                                <option value="cash_out">Cash Out (Withdraw)</option>
                                <option value="cash_in">Cash In (Deposit)</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {sandboxMessage && (
                        <div style={{ marginTop: '1rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem', color: '#fff' }}>
                          {sandboxMessage}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ minHeight: '2rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            if (window.confirm("Are you sure you want to reset the database and seed baseline values?")) {
                              triggerSeed();
                            }
                          }}
                        >
                          🔄 Reset Baseline DB
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ minHeight: '2rem', padding: '0.4rem 1.2rem', fontSize: '0.8rem', background: '#10B981', borderColor: '#10B981' }}
                          onClick={handleApplyCustomScenario}
                          disabled={sandboxLoading}
                        >
                          {sandboxLoading ? 'Applying...' : 'Apply Sandbox Scenario'}
                        </button>
                      </div>
                    </div>
                  )}

                  <h2 className="section-heading">
                    Liquidity Overview <HelpDot text="Balances are separated into shared physical cash and provider-specific e-money wallets." />
                  </h2>
                  <div className="balance-grid">
                    {/* Shared Cash Card */}
                    <div className="glass-card balance-card">
                      <span className="balance-label shared-cash-label">Shared Cash <HelpDot text="Physical cash box used when customers request cash-out. Shared across provider services." /></span>
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
                          E-Money <HelpDot text="Provider-specific wallet balance. It is never mixed or converted with another provider." />
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
                        Select a point
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
                          const points = getTrendData(agentOverview, trendHours);
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
                    <span style={{ color: 'var(--color-warning)' }}>⏳</span> Liquidity Risk <HelpDot text="Shows projected shortage risk for shared cash and each provider wallet." />
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
                              <span className="alert-provider" style={{ color: f.provider_id ? f.display_color : 'var(--color-shared-cash-text, #fff)' }}>
                                {f.provider_name}
                              </span>
                              <span className={`alert-badge ${f.risk_level}`}>
                                {f.risk_level === 'low' && f.confidence < 0.3 ? 'Uncertain / Lagging' : `${f.risk_level} Risk`}
                              </span>
                            </div>

                            {f.eta_minutes !== null ? (
                              <div className="alert-time-block">
                                <span>Projected shortage time</span>
                                <strong>~{f.eta_minutes} Mins</strong>
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
                                <div>Confidence <HelpDot text="Based on transaction volume, flow volatility, and data freshness." /></div>
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
                    <span style={{ color: 'var(--color-danger)' }}>⚡</span> Review Flags <HelpDot text="Unusual behavior signals for human review. These are not fraud verdicts." />
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
                              Review Score <HelpDot text="Higher score means the transaction pattern is farther from normal behavior. Human review is still required." />: {(a.anomaly_score * 100).toFixed(1)}% • Confidence: {(a.confidence * 100).toFixed(0)}%
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

                          {a.evidence.contributions && (
                            <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'rgba(0,0,0,0.1)', padding: '0.65rem', borderRadius: 'var(--radius-sm)' }}>
                              {[{ key: 'amount_deviation', label: 'Deviation' },
                                { key: 'velocity_surge', label: 'Velocity Spike' },
                                { key: 'identical_storm', label: 'Identical Storm' },
                                { key: 'counterparty_repeat', label: 'Counterparty Repeat' }].map(item => {
                                  const val = a.evidence.contributions[item.key] || 0.0;
                                  return (
                                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem' }}>
                                      <span style={{ width: '100px', color: 'var(--text-secondary)' }}>{item.label}:</span>
                                      <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${val * 100}%`, background: val > 0.6 ? 'var(--color-danger)' : val > 0.3 ? 'var(--color-warning)' : 'var(--color-accent)' }} />
                                      </div>
                                      <span style={{ width: '28px', textAlign: 'right', fontWeight: 'bold' }}>{(val * 100).toFixed(0)}%</span>
                                    </div>
                                  );
                              })}
                            </div>
                          )}
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
          <div className="ops-grid fade-in" role="tabpanel" aria-labelledby="tab-ops">
            <div>
              <div className="glass-card ops-header-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <div>
                    <h2 className="section-heading" style={{ marginBottom: 0 }}>🖥 Operations Case Queue</h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {cases.length} case{cases.length !== 1 ? 's' : ''} matching filters
                    </p>
                  </div>
                  <div className="acting-as-container">
                    <div className="acting-as-label">Signed In As</div>
                    <div className="acting-as-session">
                      <span>{actorName}</span>
                      <strong>{currentUser.roleLabel}</strong>
                    </div>
                  </div>
                </div>

                {cases.length > 0 && (() => {
                  const total = cases.length;
                  const open = cases.filter(c => c.status === 'open').length;
                  const ack  = cases.filter(c => c.status === 'acknowledged').length;
                  const esc  = cases.filter(c => c.status === 'escalated').length;
                  const res  = cases.filter(c => c.status === 'resolved').length;
                  return (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div className="status-summary-bar" role="progressbar" aria-label="Case status distribution">
                        <div className="status-bar-segment" style={{ width: `${(open/total)*100}%`, background: '#60A5FA' }} title={`Open: ${open}`} />
                        <div className="status-bar-segment" style={{ width: `${(ack/total)*100}%`,  background: '#F59E0B' }} title={`Acknowledged: ${ack}`} />
                        <div className="status-bar-segment" style={{ width: `${(esc/total)*100}%`,  background: '#F87171' }} title={`Escalated: ${esc}`} />
                        <div className="status-bar-segment" style={{ width: `${(res/total)*100}%`,  background: '#34D399' }} title={`Resolved: ${res}`} />
                      </div>
                      <div className="status-legend" aria-label="Case counts by status">
                        <span className="status-legend-item"><span className="status-legend-dot" style={{ background: '#60A5FA' }} />Open ({open})</span>
                        <span className="status-legend-item"><span className="status-legend-dot" style={{ background: '#F59E0B' }} />Acknowledged ({ack})</span>
                        <span className="status-legend-item"><span className="status-legend-dot" style={{ background: '#F87171' }} />Escalated ({esc})</span>
                        <span className="status-legend-item"><span className="status-legend-dot" style={{ background: '#34D399' }} />Resolved ({res})</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="filter-bar" role="search" aria-label="Case filters">
                  <div className="filter-group">
                    <label className="filter-label" htmlFor="filter-status">Filter by Status</label>
                    <select id="filter-status" className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="">All Statuses</option>
                      <option value="open">🔵 Open</option>
                      <option value="acknowledged">🟡 Acknowledged</option>
                      <option value="escalated">🔴 Escalated</option>
                      <option value="resolved">🟢 Resolved</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label className="filter-label" htmlFor="filter-role">Filter by Role</label>
                    <select
                      id="filter-role"
                      className="filter-select"
                      value={filterRole}
                      onChange={e => setFilterRole(e.target.value)}
                      disabled={isOpsRestricted}
                    >
                      {isOpsRestricted ? (
                        <option value={currentUser.role}>{getRoleLabel(currentUser.role)}</option>
                      ) : (
                        <>
                          <option value="">All Departments</option>
                          <option value="provider_ops">Provider Operations</option>
                          <option value="field_officer">Field Officer</option>
                          <option value="risk_analyst">Risk Analyst</option>
                        </>
                      )}
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
                      onClick={() => {
                        setSelectedCaseId(c.id);
                        if (window.innerWidth <= 768) setMobileDetailOpen(true);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => handleKeyActivate(e, () => {
                        setSelectedCaseId(c.id);
                        if (window.innerWidth <= 768) setMobileDetailOpen(true);
                      })}
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
            {/* On mobile this becomes a full-screen slide-over */}
            <div className={mobileDetailOpen ? 'detail-pane detail-pane--open' : 'detail-pane'}>
              {/* Mobile back button — only visible when the detail pane is open on mobile */}
              {mobileDetailOpen && (
                <button
                  className="mobile-detail-back-btn"
                  onClick={() => setMobileDetailOpen(false)}
                  aria-label="Back to case list"
                >
                  ← Back to Cases
                </button>
              )}

              {selectedCase ? (
                isOpsRestricted && selectedCase.assigned_role !== currentUser.role ? (
                  <div className="glass-card details-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 2rem', gap: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem' }}>🔒</div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#EF4444', margin: 0 }}>Access Scoped</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                      This case is routed to the <strong>{getRoleLabel(selectedCase.assigned_role)}</strong> department. 
                      Your account role is restricted to reviewing <strong>{getRoleLabel(currentUser.role)}</strong> cases only.
                    </p>
                  </div>
                ) : (
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
                      {selectedCase.assigned_to ? `👤 ${selectedCase.assigned_to} (${getRoleLabel(selectedCase.assigned_role)})` : `👥 Unassigned (${getRoleLabel(selectedCase.assigned_role)} Queue)`}
                    </div>
                  </div>

                  <div>
                    <div className="details-section-title">Recommended Coordination Action</div>
                    <div className="recommended-action-box">
                      {selectedCase.recommended_action}
                    </div>
                  </div>

                  {/* Explainable AI Risk Diagnostics (SHAP style progress bars) */}
                  {selectedCase.source_details && (
                    <div>
                      <div className="details-section-title">💡 Explainable AI Risk Diagnostics</div>
                      <div className="glass-card xai-diagnostics-box" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {selectedCase.source_type === 'anomaly' && selectedCase.source_details.evidence ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              <span>Model Prediction Urgency:</span>
                              <strong style={{ color: 'var(--color-danger)' }}>{(selectedCase.source_details.anomaly_score * 100).toFixed(0)}%</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              <span>Algorithm Confidence:</span>
                              <strong style={{ color: 'var(--color-success)' }}>{(selectedCase.source_details.confidence * 100).toFixed(0)}%</strong>
                            </div>
                            
                            {/* Feature contributions */}
                            {selectedCase.source_details.evidence.contributions && (
                              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>Feature Influence Weights</div>
                                
                                {[{ key: 'amount_deviation', label: 'Amount Deviation' },
                                  { key: 'velocity_surge', label: 'Velocity Spike (10m)' },
                                  { key: 'identical_storm', label: 'Near-Identical Storm' },
                                  { key: 'counterparty_repeat', label: 'Counterparty Repeat' },
                                  { key: 'off_hours', label: 'Off-Hours Timing' }].map(item => {
                                    const val = selectedCase.source_details.evidence.contributions[item.key] || 0.0;
                                    return (
                                      <div key={item.key} style={{ fontSize: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem', color: 'var(--text-secondary)' }}>
                                          <span>{item.label}</span>
                                          <strong>{(val * 100).toFixed(0)}%</strong>
                                        </div>
                                        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                          <div style={{ height: '100%', width: `${val * 100}%`, background: val > 0.6 ? 'var(--color-danger)' : val > 0.3 ? 'var(--color-warning)' : 'var(--color-accent)', borderRadius: '2px', transition: 'width 0.5s ease-out' }} />
                                        </div>
                                      </div>
                                    );
                                })}
                              </div>
                            )}
                          </>
                        ) : selectedCase.source_type === 'liquidity' ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              <span>Forecast Confidence:</span>
                              <strong style={{ color: 'var(--color-brand-alt)' }}>{(selectedCase.source_details.confidence * 100).toFixed(0)}%</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              <span>Projected Shortage ETA:</span>
                              <strong>{selectedCase.source_details.eta_minutes !== null ? `${selectedCase.source_details.eta_minutes} mins` : 'N/A (Stable)'}</strong>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', marginTop: '0.25rem', fontStyle: 'italic', lineHeight: 1.4 }}>
                              Reason: {selectedCase.source_details.reason}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No diagnostics details available.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions buttons based on status */}
                  <div>
                    <div className="details-section-title">Case Management Actions</div>
                    {!canManageSelectedCase && selectedCase.status !== 'resolved' && (
                      <div className="access-control-note">
                        {isManagement
                          ? 'Management has read-only oversight here. Switch to the routed operations role to update this case.'
                          : `This case is routed to ${getRoleLabel(selectedCase.assigned_role)}. Your current role can review it, but cannot change its status.`}
                      </div>
                    )}
                    
                    <div className="action-buttons-grid">
                      {selectedCase.status === 'open' && (
                        <button 
                          className={`btn ${canManageSelectedCase ? 'btn-primary' : 'btn-disabled'}`}
                          onClick={() => handleAcknowledge(selectedCase.id)}
                          disabled={!canManageSelectedCase}
                        >
                          Acknowledge Case
                        </button>
                      )}
                      
                      {selectedCase.status !== 'resolved' ? (
                        <>
                          <button 
                            className={`btn ${canManageSelectedCase ? 'btn-warning' : 'btn-disabled'}`}
                            onClick={() => { setNoteType('escalate'); setCustomNote(''); }}
                            disabled={!canManageSelectedCase}
                          >
                            Escalate Case
                          </button>
                          <button 
                            className={`btn ${canManageSelectedCase ? 'btn-success' : 'btn-disabled'}`}
                            onClick={() => { setNoteType('resolve'); setCustomNote(''); }}
                            disabled={!canManageSelectedCase}
                          >
                            Resolve Case
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-disabled" disabled>Case Resolved</button>
                      )}
                      
                      <button 
                        className={`btn ${canManageSelectedCase ? 'btn-secondary' : 'btn-disabled'} btn-span-full`}
                        onClick={() => { setNoteType('note'); setCustomNote(''); }}
                        disabled={!canManageSelectedCase}
                      >
                        Add Timeline Note
                      </button>
                    </div>

                    {selectedCase.status !== 'resolved' && (actorRole === 'management' || actorRole === 'admin') && (
                      <div className="reassign-section" style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                        <div className="details-section-title" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Re-assign Department / Role</div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <select 
                            className="mobile-select-element"
                            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', fontSize: '0.85rem', flex: 1, minHeight: '2.2rem' }}
                            value={reassignTargetRole}
                            onChange={e => setReassignTargetRole(e.target.value)}
                          >
                            <option value="provider_ops">Provider Operations (e-Money)</option>
                            <option value="field_officer">Field Officer (Physical Cash)</option>
                            <option value="risk_analyst">Risk Analyst (Anomaly / Fraud)</option>
                          </select>
                          <button 
                            className="btn btn-secondary"
                            style={{ minHeight: '2.2rem', padding: '0 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              const note = window.prompt("Enter a reassignment comment/note for the timeline:");
                              if (note !== null) {
                                handleReassignCase(selectedCase.id, reassignTargetRole, note);
                              }
                            }}
                          >
                            Re-assign
                          </button>
                        </div>
                      </div>
                    )}
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
                )
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
