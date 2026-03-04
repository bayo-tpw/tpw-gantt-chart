import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';

// ============================================================
// FINANCE — Live data from Google Sheets (published CSV)
// Sheet: "TPWNEC Finance Dashboard" — separate tabs
// Spreadsheet ID: 1qz5QLedp8uQcQB29jzaYT3LPwMxd_vOyq-F6L6fSDg0
// Tabs: Transactions, Budget, Pipeline, Settings
// ============================================================
const SHEET_ID = "1qz5QLedp8uQcQB29jzaYT3LPwMxd_vOyq-F6L6fSDg0";
const sheetURL = (tab) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

// ============================================================
// DOCUMENTS — Google Drive folder browser via Apps Script proxy
// ============================================================
const DRIVE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzuEYReDougqATtSmCBLzo0xfqkct67uSGhdS1H1nhnGFPS_Khz13QUKdIIwM3ac9ha/exec";
const DRIVE_ROOT_FOLDER = "1xWuSc1PBVBFwfMdLFmRMzs_z2WwrtO1n"; // 01_Meetings

// File type icon map for Documents tab
const DRIVE_ICONS = {
  'application/vnd.google-apps.folder': '\uD83D\uDCC1',
  'application/vnd.google-apps.document': '\uD83D\uDCC4',
  'application/vnd.google-apps.spreadsheet': '\uD83D\uDCCA',
  'application/vnd.google-apps.presentation': '\uD83D\uDCCA',
  'application/pdf': '\uD83D\uDCD5',
  'image/png': '\uD83D\uDDBC\uFE0F', 'image/jpeg': '\uD83D\uDDBC\uFE0F',
  '_default': '\uD83D\uDCC4',
};
const driveIcon = (mime) => DRIVE_ICONS[mime] || DRIVE_ICONS['_default'];

const BUDGET_MONTHS = ["Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26","May-26","Jun-26","Jul-26"];

const CAT_MAP = {
  "Programme Manager": "staffing",
  "Administrator": "directCosts",
  "Programme Delivery and Activities": "directCosts",
  "Travel, accommodation and subsistence": "directCosts",
  "Travel, accommodation and subsis": "directCosts",
  "Subscriptions & Memberships": "overheads",
};

// Lightweight CSV parser (handles quoted fields)
function parseCSV(text) {
  const rows = []; let current = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { current.push(field.trim()); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        current.push(field.trim()); field = '';
        if (current.some(c => c !== '')) rows.push(current);
        current = [];
      } else { field += ch; }
    }
  }
  current.push(field.trim());
  if (current.some(c => c !== '')) rows.push(current);
  return rows;
}

// Convert DD/MM/YYYY to YYYY-MM-DD and derive month label
function parseTxDate(raw) {
  const parts = raw.split('/');
  if (parts.length !== 3) return { iso: raw, month: '' };
  const [d, m, y] = parts;
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const monthNames = { '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec' };
  const shortYear = y.slice(-2);
  return { iso, month: `${monthNames[m.padStart(2, '0')] || m}-${shortYear}` };
}

// Parse the unified sheet CSV into sections
function parseSheetData(csvTexts) {
  const { transactions: txCSV, budget: budgetCSV, pipeline: pipelineCSV, settings: settingsCSV } = csvTexts;

  // --- TRANSACTIONS ---
  const txRows = parseCSV(txCSV);
  const transactions = txRows.slice(1).filter(r => r[0] && r[5]).map(r => {
    const { iso, month } = parseTxDate(r[0]);
    return { date: iso, detail: r[1] || '', cat: (r[4] || '').trim(), amount: parseFloat(r[5]) || 0, type: (r[3] || '').trim(), month };
  });

  // --- BUDGET ---
  const budgetRowsAll = parseCSV(budgetCSV);
  const staffCats = new Set(["Programme Manager", "Operations Lead", "Community Connector 1", "Community Connector 2", "Administrator", "Regional Lead", "Learning Manager"]);
  const budget = { staffing: new Array(12).fill(0), directCosts: new Array(12).fill(0), overheads: new Array(12).fill(0) };
  budgetRowsAll.slice(1).filter(r => r[0]).forEach(r => {
    const cat = (r[0] || '').trim();
    const type = (r[1] || '').trim();
    for (let i = 0; i < 12; i++) {
      const val = parseFloat(r[i + 2]) || 0;
      if (staffCats.has(cat) || type === 'Staff') budget.staffing[i] += val;
      else budget.directCosts[i] += val;
    }
  });
  // Derive overheads as ~17.5% of direct costs (matching original model)
  for (let i = 0; i < 12; i++) {
    budget.overheads[i] = Math.round((budget.staffing[i] + budget.directCosts[i]) * 0.0175 * 100) / 100;
  }

  // --- PIPELINE ---
  const pipeRows = parseCSV(pipelineCSV);
  const commitments = { staffing: 0, directCosts: 0 };
  const expectedIncome = [];
  pipeRows.slice(1).filter(r => r[0]).forEach(r => {
    const section = (r[0] || '').trim().toUpperCase();
    if (section === 'COMMITMENT') {
      const cat = (r[1] || '').trim().toLowerCase();
      const amount = parseFloat(r[4]) || 0;
      if (cat.includes('payroll') || cat.includes('management fee')) commitments.staffing += amount;
      else commitments.directCosts += amount;
    } else if (section === 'INCOME') {
      expectedIncome.push({
        label: (r[1] || '').trim(),
        amount: parseFloat(r[3]) || 0,
        status: (r[5] || '').trim(),
      });
    }
  });

  // --- SETTINGS ---
  const settRows = parseCSV(settingsCSV);
  const settings = {};
  settRows.slice(1).filter(r => r[0]).forEach(r => { settings[(r[0] || '').trim()] = (r[1] || '').trim(); });

  return { transactions, budget, commitments, expectedIncome, settings };
}

const fmtFinance = (n) => (n < 0 ? "-" : "") + "\u00a3" + Math.round(Math.abs(n)).toLocaleString("en-GB");
const pct = (a, b) => b === 0 ? 0 : Math.round((a / b) * 100);

export default function Home() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Data state
  const [config, setConfig] = useState({});
  const [milestones, setMilestones] = useState([]);
  const [actions, setActions] = useState([]);
  const [peopleMap, setPeopleMap] = useState({});
  const [prioritiesMap, setPrioritiesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Finance live data state
  const [financeRaw, setFinanceRaw] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState('gantt');
  const [financeTab, setFinanceTab] = useState(0);
  
  // Gantt chart filters and options
  const [groupByPriority, setGroupByPriority] = useState(true);
  const [sortByDeadline, setSortByDeadline] = useState(false);
  const [selectedPriorities, setSelectedPriorities] = useState(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState(new Set());
  const [selectedAccountable, setSelectedAccountable] = useState(new Set());
  
  // Actions filters and options
  const [groupByResponsible, setGroupByResponsible] = useState(true);
  const [groupByStatus, setGroupByStatus] = useState(false);
  const [selectedResponsible, setSelectedResponsible] = useState(new Set());
  const [selectedActionStatuses, setSelectedActionStatuses] = useState(new Set());
  const [expandedNotes, setExpandedNotes] = useState(new Set());

  // Documents (Drive browser) state
  const [drivePath, setDrivePath] = useState([{ id: DRIVE_ROOT_FOLDER, name: 'Documents' }]);
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState(null);

  // ============================================================
  // FINANCE — Fetch live data from Google Sheets (4 tabs)
  // ============================================================
  useEffect(() => {
    Promise.all([
      fetch(sheetURL('Transactions')).then(r => r.text()),
      fetch(sheetURL('Budget')).then(r => r.text()),
      fetch(sheetURL('Pipeline')).then(r => r.text()),
      fetch(sheetURL('Settings')).then(r => r.text()),
    ])
      .then(([tx, budget, pipeline, settings]) => {
        setFinanceRaw(parseSheetData({ transactions: tx, budget, pipeline, settings }));
        setFinanceLoading(false);
      })
      .catch(err => { console.error('Finance fetch error:', err); setFinanceError(err.message); setFinanceLoading(false); });
  }, []);

  // ============================================================
  // DOCUMENTS — Fetch folder contents from Apps Script proxy
  // Only fetches when Documents tab is active; re-fetches on navigation
  // ============================================================
  const currentDriveFolderId = drivePath[drivePath.length - 1].id;
  useEffect(() => {
    if (activeTab !== 'documents') return;
    setDriveLoading(true);
    setDriveError(null);
    fetch(`${DRIVE_SCRIPT_URL}?folderId=${encodeURIComponent(currentDriveFolderId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setDriveFiles(data.files || []);
        setDriveLoading(false);
      })
      .catch(err => { console.error('Drive fetch error:', err); setDriveError(err.message); setDriveLoading(false); });
  }, [currentDriveFolderId, activeTab]);

  const navigateDriveFolder = useCallback((folderId, folderName) => {
    setDrivePath(prev => [...prev, { id: folderId, name: folderName }]);
  }, []);
  const navigateDriveBreadcrumb = useCallback((index) => {
    setDrivePath(prev => prev.slice(0, index + 1));
  }, []);

  // Derived finance values from live data
  const TRANSACTIONS = financeRaw?.transactions || [];
  const BUDGET = financeRaw?.budget || { staffing: new Array(12).fill(0), directCosts: new Array(12).fill(0), overheads: new Array(12).fill(0) };
  const COMMITMENTS = financeRaw?.commitments || { staffing: 0, directCosts: 0 };
  const EXPECTED_INCOME = financeRaw?.expectedIncome || [];
  const ANNUAL_BUDGET = parseFloat(financeRaw?.settings?.annual_budget || '343150');
  const BANK_BALANCE = parseFloat(financeRaw?.settings?.bank_balance || '274');
  const OPENING_BALANCE = parseFloat(financeRaw?.settings?.opening_balance || '501');
  const YTD_MONTH_COUNT = parseInt(financeRaw?.settings?.ytd_months || '7', 10);
  const TOTAL_COMMITMENTS = COMMITMENTS.staffing + COMMITMENTS.directCosts;
  const TOTAL_EXPECTED = EXPECTED_INCOME.reduce((s, e) => s + e.amount, 0);

  // ============================================================
  // FINANCE — computed data (from approved artifact useMemo)
  // ============================================================
  const finData = useMemo(() => {
    const ytdMonths = BUDGET_MONTHS.slice(0, YTD_MONTH_COUNT);
    // Active months = months that have actual transactions
    const txMonths = new Set(TRANSACTIONS.map(t => t.month));
    const active = ytdMonths.filter(m => txMonths.has(m));
    const idxMap = {}; BUDGET_MONTHS.forEach((m, i) => { idxMap[m] = i; });
    const byMonth = {};
    ytdMonths.forEach(m => { byMonth[m] = { staffing: 0, directCosts: 0, overheads: 0, income: 0 }; });
    TRANSACTIONS.forEach(t => {
      if (!byMonth[t.month]) return;
      if (t.type === "Income") { byMonth[t.month].income += t.amount; return; }
      byMonth[t.month][CAT_MAP[t.cat] || "overheads"] += Math.abs(t.amount);
    });
    const budgetMonth = {};
    ytdMonths.forEach(m => { const i = idxMap[m]; budgetMonth[m] = { staffing: BUDGET.staffing[i], directCosts: BUDGET.directCosts[i], overheads: BUDGET.overheads[i], total: BUDGET.staffing[i] + BUDGET.directCosts[i] + BUDGET.overheads[i] }; });

    const ytdB = { staffing: 0, directCosts: 0, overheads: 0 };
    for (let i = 0; i < YTD_MONTH_COUNT; i++) { ytdB.staffing += BUDGET.staffing[i]; ytdB.directCosts += BUDGET.directCosts[i]; ytdB.overheads += BUDGET.overheads[i]; }
    ytdB.total = ytdB.staffing + ytdB.directCosts + ytdB.overheads;

    const ytdA = { staffing: 0, directCosts: 0, overheads: 0, income: 0 };
    TRANSACTIONS.forEach(t => { if (t.type === "Income") { ytdA.income += t.amount; return; } ytdA[CAT_MAP[t.cat] || "overheads"] += Math.abs(t.amount); });
    ytdA.total = ytdA.staffing + ytdA.directCosts + ytdA.overheads;

    const bva = { staffing: 0, directCosts: 0, overheads: 0, spend: 0, budget: 0 };
    ytdMonths.forEach(m => { const a = byMonth[m], b = budgetMonth[m]; bva.staffing += a.staffing; bva.directCosts += a.directCosts; bva.overheads += a.overheads; bva.spend += a.staffing + a.directCosts + a.overheads; bva.budget += b.total; });
    bva.variance = bva.budget - bva.spend;

    const cf = []; let bal = OPENING_BALANCE;
    active.forEach(m => { const a = byMonth[m]; const out = a.staffing + a.directCosts + a.overheads; bal = bal + a.income - out; cf.push({ month: m, inflow: a.income, outflow: out, net: a.income - out, balance: bal }); });

    return { active, ytdMonths, byMonth, budgetMonth, ytdB, ytdA, bva, cf, truePos: BANK_BALANCE - TOTAL_COMMITMENTS + TOTAL_EXPECTED };
  }, [financeRaw]);

  const rag = (a, b) => { if (b === 0) return a === 0 ? "#16a34a" : "#dc2626"; const r = a / b; return r <= 0.85 ? "#16a34a" : r <= 1.0 ? "#ca8a04" : "#dc2626"; };
  const C = { bg: "#f8f9fb", card: "#ffffff", border: "#e5e7eb", text: "#1e293b", sub: "#64748b", muted: "#94a3b8", accent: "#2563eb", green: "#16a34a", amber: "#d97706", red: "#dc2626", purple: "#7c3aed" };
  const fCard = { background: C.card, borderRadius: 12, border: "1px solid " + C.border, overflow: "hidden" };
  const fHead = { padding: "16px 24px", borderBottom: "1px solid " + C.border };
  const FINANCE_TABS = ["Overview", "Budget vs Actuals", "Pipeline", "Cashflow"];

  // Fetch data on mount
  useEffect(() => {
    fetch('/api/airtable')
      .then(res => res.json())
      .then(data => {
        setConfig(data.config || {});
        setMilestones(data.milestones || []);
        setActions(data.actions || []);
        setPeopleMap(data.peopleMap || {});
        setPrioritiesMap(data.prioritiesMap || {});
        
        const allPriorities = new Set((data.milestones || []).map(m => m.priority).filter(Boolean));
        setSelectedPriorities(allPriorities);
        const allMilestoneStatuses = new Set((data.milestones || []).map(m => m.status).filter(Boolean));
        setSelectedStatuses(allMilestoneStatuses);
        const allAccountable = new Set((data.milestones || []).map(m => m.accountable).filter(Boolean));
        setSelectedAccountable(allAccountable);
        const allResponsible = new Set((data.actions || []).map(a => a.responsible).filter(Boolean));
        setSelectedResponsible(allResponsible);
        const allActionStatuses = new Set((data.actions || []).map(a => a.status).filter(Boolean));
        setSelectedActionStatuses(allActionStatuses);
        
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const correctPassword = 'TPW2025!';

  const handleLogin = () => {
    if (password === correctPassword) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <Head>
          <title>TPW Regional Delivery Action Plan - Login</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui', backgroundColor: '#f8fafc' }}>
          <div style={{ padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxWidth: '450px', width: '90%' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h1 style={{ marginBottom: '8px', color: '#1e293b', fontSize: '24px', fontWeight: '700' }}>TPW Regional Delivery Action Plan</h1>
              <p style={{ marginBottom: '0', color: '#64748b', fontSize: '14px' }}>North-East & Cumbria Regional Delivery</p>
            </div>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151', fontSize: '14px' }}>Access Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={handleKeyPress}
                style={{ width: '100%', padding: '12px 16px', border: authError ? '2px solid #ef4444' : '2px solid #e2e8f0', borderRadius: '8px', fontSize: '16px', fontFamily: 'system-ui', transition: 'border-color 0.2s', outline: 'none' }}
                placeholder="Enter dashboard password"
                onFocus={(e) => { if (!authError) e.target.style.borderColor = '#3b82f6'; }}
                onBlur={(e) => { if (!authError) e.target.style.borderColor = '#e2e8f0'; }}
              />
              {authError && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '8px', marginBottom: '0' }}>{authError}</p>}
            </div>
            <button onClick={handleLogin}
              style={{ width: '100%', padding: '14px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
              onMouseEnter={(e) => { e.target.style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { e.target.style.backgroundColor = '#3b82f6'; }}>
              Access Dashboard
            </button>
            <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px', fontSize: '13px', color: '#0369a1' }}>
              <strong>Note:</strong> This dashboard contains confidential project information. Please ensure you have authorisation to access this content.
            </div>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1>TPW Regional Delivery Action Plan</h1>
        <p>Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1>TPW Regional Delivery Action Plan</h1>
        <p style={{ color: 'red' }}>Error loading data: {error}</p>
      </div>
    );
  }

  // ============================================================
  // GANTT CHART DATA PROCESSING
  // ============================================================
  const chartData = milestones.map(milestone => {
    const name = milestone.name || 'Unnamed Activity';
    const deadline = milestone.deadline || '';
    const startDateField = milestone.startDate || '';
    const priority = milestone.priority || 'No Priority';
    const status = milestone.status || 'No Status';
    const accountable = milestone.accountable || 'Unassigned';
    
    let startDate;
    if (startDateField) {
      startDate = new Date(startDateField);
    } else {
      const deadlineDate = new Date(deadline);
      startDate = new Date(deadlineDate);
      startDate.setMonth(startDate.getMonth() - 3);
    }
    const deadlineDate = new Date(deadline);
    
    return { id: milestone.id, name, priority, status, accountable, start: startDate, end: deadlineDate, deadline, hasStartDate: !!startDateField };
  });
  
  const priorities = [...new Set(milestones.map(m => m.priority).filter(Boolean))].sort();
  const milestoneStatuses = [...new Set(milestones.map(m => m.status).filter(Boolean))].sort();
  const accountablePeople = [...new Set(milestones.map(m => m.accountable).filter(Boolean))].sort();
  
  const filteredChartData = chartData
    .filter(item => item.deadline)
    .filter(item => selectedPriorities.has(item.priority))
    .filter(item => selectedStatuses.has(item.status))
    .filter(item => selectedAccountable.has(item.accountable));

  let sortedData = [...filteredChartData];
  if (sortByDeadline) {
    sortedData.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  const organizedData = groupByPriority
    ? priorities.filter(priority => selectedPriorities.has(priority))
        .map(priority => ({ priority, items: sortedData.filter(item => item.priority === priority) }))
        .filter(group => group.items.length > 0)
    : [{ priority: null, items: sortedData }];

  const togglePriority = (priority) => { const n = new Set(selectedPriorities); n.has(priority) ? n.delete(priority) : n.add(priority); setSelectedPriorities(n); };
  const selectAllPriorities = () => setSelectedPriorities(new Set(priorities));
  const deselectAllPriorities = () => setSelectedPriorities(new Set());
  const toggleStatus = (status) => { const n = new Set(selectedStatuses); n.has(status) ? n.delete(status) : n.add(status); setSelectedStatuses(n); };
  const selectAllStatuses = () => setSelectedStatuses(new Set(milestoneStatuses));
  const deselectAllStatuses = () => setSelectedStatuses(new Set());
  const toggleAccountable = (person) => { const n = new Set(selectedAccountable); n.has(person) ? n.delete(person) : n.add(person); setSelectedAccountable(n); };
  const selectAllAccountable = () => setSelectedAccountable(new Set(accountablePeople));
  const deselectAllAccountable = () => setSelectedAccountable(new Set());

  const priorityColors = {
    '1. Governance and Leadership': '#3b82f6',
    '2. Grant making': '#10b981',
    '3. Capability support and development': '#eab308',
    '4. Learning and Impact': '#ef4444'
  };

  const allDates = chartData.flatMap(item => [item.start, item.end]);
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();
  minDate.setDate(1);
  maxDate.setMonth(maxDate.getMonth() + 1);
  maxDate.setDate(0);

  const months = [];
  let current = new Date(minDate);
  while (current <= maxDate) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
  const getPosition = (date) => { const days = (date - minDate) / (1000 * 60 * 60 * 24); return (days / totalDays) * 100; };
  const formatMonth = (date) => date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

  // ============================================================
  // ACTIONS DATA PROCESSING
  // ============================================================
  const processedActions = actions.map(action => ({
    id: action.id, name: action.name || 'Unnamed Action', responsible: action.responsible || 'Unassigned',
    deadline: action.deadline || '', status: action.status || 'No Status', tpwRole: action.tpwRole || '', notes: action.notes || ''
  }));
  
  const filteredActions = processedActions
    .filter(action => action.name !== 'Unnamed Action')
    .filter(action => selectedResponsible.has(action.responsible))
    .filter(action => selectedActionStatuses.has(action.status));

  let sortedActions = [...filteredActions].sort((a, b) => {
    if (!a.deadline) return 1; if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  const allResponsiblePeople = [...new Set(actions.map(a => a.responsible).filter(Boolean))].sort();
  const allActionStatuses = [...new Set(actions.map(a => a.status).filter(Boolean))].sort();

  const statusColors = {
    'Not started': '#94a3b8', 'In progress': '#3b82f6', 'Complete': '#10b981',
    'To do': '#f59e0b', 'Done': '#10b981', 'On hold': '#f59e0b', 'Cancelled': '#ef4444'
  };

  let organizedActions;
  if (groupByStatus) {
    organizedActions = allActionStatuses.filter(s => selectedActionStatuses.has(s))
      .map(status => ({ groupName: status, groupType: 'status', items: sortedActions.filter(a => a.status === status) }))
      .filter(g => g.items.length > 0);
  } else if (groupByResponsible) {
    organizedActions = allResponsiblePeople.filter(p => selectedResponsible.has(p))
      .map(responsible => ({ groupName: responsible, groupType: 'responsible', items: sortedActions.filter(a => a.responsible === responsible) }))
      .filter(g => g.items.length > 0);
  } else {
    organizedActions = [{ groupName: null, groupType: null, items: sortedActions }];
  }

  const toggleResponsible = (person) => { const n = new Set(selectedResponsible); n.has(person) ? n.delete(person) : n.add(person); setSelectedResponsible(n); };
  const selectAllResponsible = () => setSelectedResponsible(new Set(allResponsiblePeople));
  const deselectAllResponsible = () => setSelectedResponsible(new Set());
  const toggleActionStatus = (status) => { const n = new Set(selectedActionStatuses); n.has(status) ? n.delete(status) : n.add(status); setSelectedActionStatuses(n); };
  const selectAllActionStatuses = () => setSelectedActionStatuses(new Set(allActionStatuses));
  const deselectAllActionStatuses = () => setSelectedActionStatuses(new Set());
  const formatDate = (dateStr) => { if (!dateStr) return '-'; return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <>
      <Head>
        <title>TPW Regional Delivery Action Plan</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      
      <div style={{ padding: '20px', fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{ color: '#1e293b', marginBottom: '8px' }}>
            TPW Regional Delivery Action Plan
          </h1>
          <p style={{ color: '#64748b', marginBottom: '30px' }}>
            North-East & Cumbria Regional Delivery | August 2025 - July 2026
          </p>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
            {[
              { id: 'gantt', label: 'Gantt Chart' },
              { id: 'actions', label: 'Actions' },
              { id: 'finance', label: 'Finance' },
              { id: 'documents', label: 'Documents' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 24px', fontSize: '15px', fontWeight: '600', border: 'none',
                  borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  color: activeTab === tab.id ? '#3b82f6' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ============================================================ */}
          {/* GANTT CHART TAB */}
          {/* ============================================================ */}
          {activeTab === 'gantt' && (
            <>
              {/* Priority Filter */}
              <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>Filter by Priority Area:</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={selectAllPriorities} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Select All</button>
                    <button onClick={deselectAllPriorities} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Clear All</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {priorities.map(priority => {
                    const isSelected = selectedPriorities.has(priority);
                    return (
                      <label key={priority} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: '1px solid', borderColor: isSelected ? priorityColors[priority] || '#94a3b8' : '#e2e8f0', backgroundColor: isSelected ? `${priorityColors[priority] || '#94a3b8'}10` : 'white', transition: 'all 0.2s' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => togglePriority(priority)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: priorityColors[priority] || '#94a3b8' }} />
                        <div style={{ width: '12px', height: '12px', backgroundColor: priorityColors[priority] || '#94a3b8', borderRadius: '2px', opacity: isSelected ? 1 : 0.3 }} />
                        <span style={{ fontSize: '14px', color: isSelected ? '#1e293b' : '#94a3b8', fontWeight: isSelected ? '500' : '400' }}>{priority}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Filter */}
              <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>Filter by Status:</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={selectAllStatuses} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Select All</button>
                    <button onClick={deselectAllStatuses} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Clear All</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {milestoneStatuses.map(status => {
                    const isSelected = selectedStatuses.has(status);
                    return (
                      <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: '1px solid', borderColor: isSelected ? '#8b5cf6' : '#e2e8f0', backgroundColor: isSelected ? '#f5f3ff' : 'white', transition: 'all 0.2s' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleStatus(status)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#8b5cf6' }} />
                        <span style={{ fontSize: '14px', color: isSelected ? '#1e293b' : '#94a3b8', fontWeight: isSelected ? '500' : '400' }}>{status}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Accountable Filter */}
              <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>Filter by Accountable:</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={selectAllAccountable} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Select All</button>
                    <button onClick={deselectAllAccountable} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Clear All</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {accountablePeople.map(person => {
                    const isSelected = selectedAccountable.has(person);
                    return (
                      <label key={person} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: '1px solid', borderColor: isSelected ? '#06b6d4' : '#e2e8f0', backgroundColor: isSelected ? '#ecfeff' : 'white', transition: 'all 0.2s' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleAccountable(person)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#06b6d4' }} />
                        <span style={{ fontSize: '14px', color: isSelected ? '#1e293b' : '#94a3b8', fontWeight: isSelected ? '500' : '400' }}>{person}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* View Options */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', color: '#1e293b', marginRight: '10px' }}>View Options:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={groupByPriority} onChange={(e) => setGroupByPriority(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <span style={{ fontSize: '14px', color: '#475569' }}>Group by Priority</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sortByDeadline} onChange={(e) => setSortByDeadline(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <span style={{ fontSize: '14px', color: '#475569' }}>Sort by Deadline</span>
                </label>
              </div>

              {/* Gantt Chart */}
              <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ width: '300px', padding: '12px 16px', fontWeight: '600', color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>Activity</div>
                  <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                    {months.map((month, idx) => (
                      <div key={idx} style={{ flex: 1, padding: '12px 8px', textAlign: 'center', fontSize: '13px', fontWeight: '500', color: '#64748b', borderRight: idx < months.length - 1 ? '1px solid #e2e8f0' : 'none' }}>{formatMonth(month)}</div>
                    ))}
                  </div>
                </div>
                {organizedData.map((group, groupIdx) => (
                  <div key={groupIdx}>
                    {groupByPriority && (
                      <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', fontWeight: '600', fontSize: '14px', color: '#334155', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
                        <div style={{ width: '300px', borderRight: '1px solid #cbd5e1' }}>{group.priority}</div>
                        <div style={{ flex: 1, paddingLeft: '16px', color: '#64748b' }}>{group.items.length} milestone{group.items.length !== 1 ? 's' : ''}</div>
                      </div>
                    )}
                    {group.items.map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', minHeight: '60px', alignItems: 'center', backgroundColor: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <div style={{ width: '300px', padding: '12px 16px', borderRight: '1px solid #e2e8f0', fontSize: '14px', color: '#334155', lineHeight: '1.4' }}>
                          <div style={{ fontWeight: '500', marginBottom: '4px' }}>{item.name}</div>
                          {!groupByPriority && <div style={{ fontSize: '12px', color: '#64748b' }}>{item.priority}</div>}
                        </div>
                        <div style={{ flex: 1, position: 'relative', padding: '8px 0' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex' }}>
                            {months.map((_, idx) => (<div key={idx} style={{ flex: 1, borderRight: idx < months.length - 1 ? '1px solid #f1f5f9' : 'none' }} />))}
                          </div>
                          <div style={{
                            position: 'absolute', left: `${getPosition(item.start)}%`, width: `${getPosition(item.end) - getPosition(item.start)}%`,
                            height: '32px', backgroundColor: priorityColors[item.priority] || '#94a3b8', borderRadius: '4px',
                            top: '50%', transform: 'translateY(-50%)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', color: 'white', fontWeight: '500', padding: '0 8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                          }}>
                            Due: {new Date(item.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Summary Stats */}
              <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Total Milestones {(selectedPriorities.size < priorities.length || selectedStatuses.size < milestoneStatuses.length || selectedAccountable.size < accountablePeople.length) ? '(Filtered)' : ''}</div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>{filteredChartData.length}</div>
                </div>
                {priorities.filter(p => selectedPriorities.has(p)).map(priority => {
                  const count = filteredChartData.filter(item => item.priority === priority).length;
                  return (
                    <div key={priority} style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>{priority}</div>
                      <div style={{ fontSize: '32px', fontWeight: '700', color: priorityColors[priority] }}>{count}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px', fontSize: '14px', color: '#0369a1' }}>
                <strong>Note:</strong> {chartData.some(item => item.hasStartDate) 
                  ? 'Milestones with start dates show actual duration. Others estimate 3 months before deadline.'
                  : 'Start dates are estimated as 3 months before each deadline for visualisation purposes.'}
                {' '}Data synced from Airtable in real-time.
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* ACTIONS TAB */}
          {/* ============================================================ */}
          {activeTab === 'actions' && (
            <>
              {/* Filter by Responsible */}
              <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>Filter by Responsible:</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={selectAllResponsible} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Select All</button>
                    <button onClick={deselectAllResponsible} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Clear All</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {allResponsiblePeople.map(person => {
                    const isSelected = selectedResponsible.has(person);
                    return (
                      <label key={person} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: '1px solid', borderColor: isSelected ? '#3b82f6' : '#e2e8f0', backgroundColor: isSelected ? '#eff6ff' : 'white', transition: 'all 0.2s' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleResponsible(person)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }} />
                        <span style={{ fontSize: '14px', color: isSelected ? '#1e293b' : '#94a3b8', fontWeight: isSelected ? '500' : '400' }}>{person}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Filter by Status */}
              <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>Filter by Status:</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={selectAllActionStatuses} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Select All</button>
                    <button onClick={deselectAllActionStatuses} style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>Clear All</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {allActionStatuses.map(status => {
                    const isSelected = selectedActionStatuses.has(status);
                    return (
                      <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', border: '1px solid', borderColor: isSelected ? '#10b981' : '#e2e8f0', backgroundColor: isSelected ? '#f0fdf4' : 'white', transition: 'all 0.2s' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleActionStatus(status)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }} />
                        <span style={{ fontSize: '14px', color: isSelected ? '#1e293b' : '#94a3b8', fontWeight: isSelected ? '500' : '400' }}>{status}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* View Options */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', color: '#1e293b', marginRight: '10px' }}>View Options:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={groupByResponsible} onChange={(e) => { setGroupByResponsible(e.target.checked); if (e.target.checked) setGroupByStatus(false); }} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <span style={{ fontSize: '14px', color: '#475569' }}>Group by Responsible</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={groupByStatus} onChange={(e) => { setGroupByStatus(e.target.checked); if (e.target.checked) setGroupByResponsible(false); }} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <span style={{ fontSize: '14px', color: '#475569' }}>Group by Status</span>
                </label>
                <div style={{ marginLeft: 'auto', padding: '6px 12px', backgroundColor: '#f0f9ff', borderRadius: '4px', fontSize: '13px', color: '#0369a1', fontWeight: '500' }}>
                  Sorted by: Deadline (earliest first)
                </div>
              </div>

              {/* Actions Table */}
              <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.5fr', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                  <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>Name</div>
                  <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>Responsible</div>
                  <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>Deadline</div>
                  <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>Status</div>
                  <div style={{ padding: '12px 16px' }}>Notes</div>
                </div>
                {organizedActions.map((group, groupIdx) => (
                  <div key={groupIdx}>
                    {(groupByResponsible || groupByStatus) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.5fr', backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', fontWeight: '600', fontSize: '14px', color: '#334155', padding: '12px 16px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>{group.groupName} ({group.items.length} action{group.items.length !== 1 ? 's' : ''})</div>
                      </div>
                    )}
                    {group.items.map((action, idx) => {
                      const isExpanded = expandedNotes.has(action.id);
                      const hasNotes = action.notes && action.notes.trim().length > 0;
                      return (
                        <div key={action.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.5fr', borderBottom: isExpanded ? 'none' : '1px solid #e2e8f0' }}>
                            <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', fontSize: '14px', color: '#334155' }}>{action.name}</div>
                            <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', fontSize: '14px', color: groupByResponsible ? '#64748b' : '#334155' }}>{groupByResponsible ? '' : action.responsible}</div>
                            <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', fontSize: '14px', color: '#334155' }}>{formatDate(action.deadline)}</div>
                            <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', fontSize: '14px' }}>
                              {groupByStatus ? <span style={{ color: '#64748b' }}></span> : (
                                <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '13px', fontWeight: '500', backgroundColor: `${statusColors[action.status] || '#94a3b8'}20`, color: statusColors[action.status] || '#334155', display: 'inline-block' }}>{action.status}</span>
                              )}
                            </div>
                            <div style={{ padding: '12px 16px', fontSize: '14px', textAlign: 'center' }}>
                              {hasNotes ? (
                                <button onClick={() => { const n = new Set(expandedNotes); isExpanded ? n.delete(action.id) : n.add(action.id); setExpandedNotes(n); }}
                                  style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '16px', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
                                  title={isExpanded ? 'Collapse notes' : 'Expand notes'}>
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                              ) : <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>}
                            </div>
                          </div>
                          {isExpanded && hasNotes && (
                            <div style={{ gridColumn: '1 / -1', padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderLeft: '3px solid #3b82f6' }}>
                              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '6px' }}>Notes:</div>
                              <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{action.notes}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Actions Summary */}
              <div style={{ marginTop: '20px', padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Total Actions {(selectedResponsible.size < allResponsiblePeople.length || selectedActionStatuses.size < allActionStatuses.length) ? '(Filtered)' : ''}</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>{filteredActions.length}</div>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* FINANCE TAB — Approved tpwnec_dashboard.jsx layout */}
          {/* ============================================================ */}
          {activeTab === 'finance' && (
            <div style={{ fontFamily: "'Source Sans 3','Segoe UI',system-ui,sans-serif", background: C.bg, color: C.text, padding: "0", maxWidth: 1080, margin: "0 auto" }}>
              {financeLoading ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: 16, color: C.sub, marginBottom: 8 }}>Loading finance data from Google Sheets...</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Fetching live data</div>
                </div>
              ) : financeError ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: 16, color: C.red, marginBottom: 8 }}>Error loading finance data</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{financeError}</div>
                </div>
              ) : (<>
              <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: C.muted, textTransform: "uppercase" }}>TPWNEC</div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, margin: "2px 0 0", color: C.text }}>Financial Dashboard</h2>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Year 1 &middot; Aug 2025 – Jul 2026 &middot; Live from Google Sheets</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: C.sub }}>Year 1 Grant Award</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{fmtFinance(ANNUAL_BUDGET)}</div>
                  <div style={{ fontSize: 10, color: C.green, marginTop: 2 }}>● Live data &middot; {TRANSACTIONS.length} transactions</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 2, marginBottom: 22, borderBottom: "2px solid " + C.border, flexWrap: "wrap" }}>
                {FINANCE_TABS.map((t, i) => (
                  <button key={t} onClick={() => setFinanceTab(i)} style={{ padding: "10px 20px", fontSize: 13, fontWeight: financeTab === i ? 600 : 400, cursor: "pointer", border: "none", borderBottom: financeTab === i ? "2px solid " + C.accent : "2px solid transparent", background: "transparent", color: financeTab === i ? C.accent : C.sub, marginBottom: -2, transition: "all 0.15s" }}>{t}</button>
                ))}
              </div>

              {/* OVERVIEW TAB */}
              {financeTab === 0 && (<div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
                  {[
                    { label: "Cash in Bank", value: BANK_BALANCE, color: C.accent, sub: "28 Feb 2026" },
                    { label: "Committed Costs", value: -TOTAL_COMMITMENTS, color: C.amber, sub: "Owed to partners" },
                    { label: "Expected Income", value: TOTAL_EXPECTED, color: C.green, sub: "Q2 Lottery drawdown" },
                    { label: "True Position", value: finData.truePos, color: finData.truePos >= 0 ? C.green : C.red, sub: "Net after pipeline" },
                  ].map((c, i) => (
                    <div key={i} style={{ ...fCard, padding: "18px 20px", position: "relative" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: c.color }} />
                      <div style={{ fontSize: 11, color: C.sub, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{c.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: c.color, letterSpacing: -0.5 }}>{fmtFinance(c.value)}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{c.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ ...fCard, marginBottom: 18 }}>
                  <div style={fHead}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Year to Date &middot; Budget vs Spend</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Aug 2025 – {finData.ytdMonths[finData.ytdMonths.length - 1] || 'Feb 2026'} ({YTD_MONTH_COUNT} months)</div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ padding: "10px 20px", textAlign: "left", color: C.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Category</th>
                        <th style={{ padding: "10px 16px", textAlign: "right", color: C.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Budget</th>
                        <th style={{ padding: "10px 16px", textAlign: "right", color: C.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Spent</th>
                        <th style={{ padding: "10px 16px", textAlign: "right", color: C.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Remaining</th>
                        <th style={{ padding: "10px 20px", textAlign: "right", color: C.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, minWidth: 130 }}>Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Staffing", budget: finData.ytdB.staffing, actual: finData.ytdA.staffing },
                        { label: "Direct Costs", budget: finData.ytdB.directCosts, actual: finData.ytdA.directCosts },
                        { label: "Overheads", budget: finData.ytdB.overheads, actual: finData.ytdA.overheads },
                      ].map((r, i) => { const p = pct(r.actual, r.budget); const rem = r.budget - r.actual; return (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 20px", fontWeight: 500 }}>{r.label}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", color: C.sub }}>{fmtFinance(r.budget)}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600 }}>{fmtFinance(r.actual)}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", color: rem >= 0 ? C.green : C.red, fontWeight: 500 }}>{fmtFinance(rem)}</td>
                          <td style={{ padding: "14px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                              <div style={{ width: 70, height: 7, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                                <div style={{ height: "100%", width: Math.min(p, 100) + "%", background: rag(r.actual, r.budget), borderRadius: 4 }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: rag(r.actual, r.budget), minWidth: 34, textAlign: "right" }}>{p}%</span>
                            </div>
                          </td>
                        </tr>
                      ); })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid " + C.border, background: "#f8fafc" }}>
                        {(() => { const p = pct(finData.ytdA.total, finData.ytdB.total); const rem = finData.ytdB.total - finData.ytdA.total; return (<>
                          <td style={{ padding: "14px 20px", fontWeight: 700 }}>Total</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: C.sub }}>{fmtFinance(finData.ytdB.total)}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700 }}>{fmtFinance(finData.ytdA.total)}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: rem >= 0 ? C.green : C.red }}>{fmtFinance(rem)}</td>
                          <td style={{ padding: "14px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                              <div style={{ width: 70, height: 7, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                                <div style={{ height: "100%", width: Math.min(p, 100) + "%", background: rag(finData.ytdA.total, finData.ytdB.total), borderRadius: 4 }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: rag(finData.ytdA.total, finData.ytdB.total), minWidth: 34, textAlign: "right" }}>{p}%</span>
                            </div>
                          </td>
                        </>); })()}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div style={{ ...fCard, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <span style={{ fontSize: 13, color: C.sub }}>Programme progress</span>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {BUDGET_MONTHS.map((m, i) => (<div key={m} title={m} style={{ width: 22, height: 6, borderRadius: 3, background: i < YTD_MONTH_COUNT ? C.accent : "#e2e8f0" }} />))}
                    <span style={{ fontSize: 12, color: C.sub, marginLeft: 8 }}>{YTD_MONTH_COUNT} of 12 months</span>
                  </div>
                </div>
              </div>)}

              {/* BUDGET VS ACTUALS TAB */}
              {financeTab === 1 && (<div>
                <div style={{ ...fCard, marginBottom: 18 }}>
                  <div style={fHead}><div style={{ fontSize: 14, fontWeight: 600 }}>Monthly Spend by Category</div></div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead><tr style={{ borderBottom: "1px solid " + C.border }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: C.sub, fontWeight: 500 }}>Month</th>
                        {["Staffing", "Direct Costs", "Overheads", "Total Spend", "Budget", "Variance"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "right", color: C.sub, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {finData.ytdMonths.map(m => { const a = finData.byMonth[m], b = finData.budgetMonth[m]; const spend = a.staffing + a.directCosts + a.overheads; const v = b.total - spend; return (
                          <tr key={m} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 16px", fontWeight: 500 }}>{m}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.sub }}>{fmtFinance(a.staffing)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.sub }}>{fmtFinance(a.directCosts)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.sub }}>{fmtFinance(a.overheads)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{fmtFinance(spend)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.sub }}>{fmtFinance(b.total)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: v >= 0 ? C.green : C.red }}>{v >= 0 ? "+" : ""}{fmtFinance(v)}</td>
                          </tr>
                        ); })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: "2px solid " + C.border, background: "#f8fafc" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700 }}>Total</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 600, color: C.sub }}>{fmtFinance(finData.bva.staffing)}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 600, color: C.sub }}>{fmtFinance(finData.bva.directCosts)}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 600, color: C.sub }}>{fmtFinance(finData.bva.overheads)}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700 }}>{fmtFinance(finData.bva.spend)}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 600, color: C.sub }}>{fmtFinance(finData.bva.budget)}</td>
                          <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, color: finData.bva.variance >= 0 ? C.green : C.red }}>{finData.bva.variance >= 0 ? "+" : ""}{fmtFinance(finData.bva.variance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>)}

              {/* PIPELINE TAB */}
              {financeTab === 2 && (<div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginBottom: 22 }}>
                  <div style={fCard}>
                    <div style={{ ...fHead, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.amber }}>Outstanding Commitments</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.amber }}>{fmtFinance(TOTAL_COMMITMENTS)}</div>
                    </div>
                    {[
                      { label: "Staffing", amount: COMMITMENTS.staffing },
                      { label: "Direct Costs", amount: COMMITMENTS.directCosts },
                    ].map((c, i) => (
                      <div key={i} style={{ padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i === 0 ? "1px solid #f1f5f9" : "none", gap: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.amber, whiteSpace: "nowrap" }}>{fmtFinance(c.amount)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={fCard}>
                    <div style={{ ...fHead, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>Expected Income</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{fmtFinance(TOTAL_EXPECTED)}</div>
                    </div>
                    {EXPECTED_INCOME.map((e, i) => (
                      <div key={i} style={{ padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{e.label}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{e.status}</div></div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.green, whiteSpace: "nowrap" }}>{fmtFinance(e.amount)}</div>
                      </div>
                    ))}
                    <div style={{ padding: "16px 24px", borderTop: "1px solid " + C.border, background: "#f8fdf9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Net Pipeline</div><div style={{ fontSize: 11, color: C.muted }}>Income minus commitments</div></div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>+{fmtFinance(TOTAL_EXPECTED - TOTAL_COMMITMENTS)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ ...fCard, padding: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>True Financial Position</div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 28, height: 200, flexWrap: "wrap" }}>
                    {[
                      { label: "Cash in Bank", value: BANK_BALANCE, color: C.accent },
                      { label: "Commitments", value: -TOTAL_COMMITMENTS, color: C.amber },
                      { label: "Expected Income", value: TOTAL_EXPECTED, color: C.green },
                      { label: "True Position", value: finData.truePos, color: C.purple },
                    ].map((b, i) => { const mx = Math.max(TOTAL_EXPECTED, TOTAL_COMMITMENTS, finData.truePos); const h = Math.max(18, (Math.abs(b.value) / mx) * 150); return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: b.color, marginBottom: 6 }}>{fmtFinance(b.value)}</div>
                        <div style={{ width: 52, height: h, background: b.color, borderRadius: "6px 6px 0 0", opacity: 0.8 }} />
                        <div style={{ fontSize: 11, color: C.sub, marginTop: 8, textAlign: "center" }}>{b.label}</div>
                      </div>
                    ); })}
                  </div>
                </div>
              </div>)}

              {/* CASHFLOW TAB */}
              {financeTab === 3 && (<div>
                <div style={{ ...fCard, marginBottom: 18 }}>
                  <div style={fHead}><div style={{ fontSize: 14, fontWeight: 600 }}>Monthly Cashflow</div></div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead><tr style={{ borderBottom: "1px solid " + C.border }}>
                        {["Month", "Money In", "Money Out", "Net", "Balance"].map(h => (
                          <th key={h} style={{ padding: "10px 20px", textAlign: h === "Month" ? "left" : "right", color: C.sub, fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {finData.cf.map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px 20px", fontWeight: 500 }}>{r.month}</td>
                            <td style={{ padding: "12px 20px", textAlign: "right", color: C.green }}>{fmtFinance(r.inflow)}</td>
                            <td style={{ padding: "12px 20px", textAlign: "right", color: C.red }}>{fmtFinance(r.outflow)}</td>
                            <td style={{ padding: "12px 20px", textAlign: "right", fontWeight: 600, color: r.net >= 0 ? C.green : C.red }}>{r.net >= 0 ? "+" : ""}{fmtFinance(r.net)}</td>
                            <td style={{ padding: "12px 20px", textAlign: "right", fontWeight: 600 }}>{fmtFinance(r.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div style={{ ...fCard, padding: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Balance Trend</div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 150 }}>
                    {finData.cf.map((r, i) => { const mx = Math.max(...finData.cf.map(x => Math.abs(x.balance))); const h = Math.max(8, (Math.abs(r.balance) / mx) * 120); return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: r.balance >= 0 ? C.green : C.red, marginBottom: 4 }}>{fmtFinance(r.balance)}</div>
                        <div style={{ width: 44, height: h, background: r.balance >= 0 ? C.green : C.red, borderRadius: "5px 5px 0 0", opacity: 0.7 }} />
                        <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>{r.month}</div>
                      </div>
                    ); })}
                  </div>
                </div>
                <div style={{ background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe", padding: "14px 20px", fontSize: 12, color: "#1e40af", marginTop: 16 }}>
                  <strong>Note:</strong> Cashflow shows bank movements only. No income received since Dec 2025. Q2 drawdown ({fmtFinance(TOTAL_EXPECTED)}) expected imminently.
                </div>
              </div>)}
            </>)}
            </div>
          )}

          {/* ============================================================ */}
          {/* DOCUMENTS TAB — Google Drive folder browser */}
          {/* ============================================================ */}
          {activeTab === 'documents' && (
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {/* Breadcrumb navigation */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', fontSize: '14px' }}>
                {drivePath.map((crumb, i) => (
                  <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {i > 0 && <span style={{ color: '#94a3b8' }}>/</span>}
                    {i < drivePath.length - 1 ? (
                      <button onClick={() => navigateDriveBreadcrumb(i)}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: '500', padding: '2px 4px', borderRadius: '4px', fontSize: '14px' }}>
                        {crumb.name}
                      </button>
                    ) : (
                      <span style={{ fontWeight: '600', color: '#1e293b', padding: '2px 4px' }}>{crumb.name}</span>
                    )}
                  </span>
                ))}
              </div>

              {/* Loading state */}
              {driveLoading && (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>Loading...</div>
                  <div style={{ fontSize: '13px' }}>Fetching folder contents from Google Drive</div>
                </div>
              )}

              {/* Error state */}
              {driveError && !driveLoading && (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ color: '#dc2626', fontWeight: '600', marginBottom: '8px' }}>Failed to load folder</div>
                  <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>{driveError}</div>
                  <button onClick={() => setDrivePath([...drivePath])}
                    style={{ padding: '8px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                    Retry
                  </button>
                </div>
              )}

              {/* Empty folder */}
              {!driveLoading && !driveError && driveFiles.length === 0 && (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  This folder is empty.
                </div>
              )}

              {/* File listing */}
              {!driveLoading && !driveError && driveFiles.length > 0 && (
                <div>
                  {driveFiles.map((file, i) => {
                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                    const modified = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                    return (
                      <div key={file.id}
                        onClick={() => isFolder ? navigateDriveFolder(file.id, file.name) : window.open(file.url, '_blank')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 20px', cursor: 'pointer',
                          borderBottom: i < driveFiles.length - 1 ? '1px solid #f1f5f9' : 'none',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ fontSize: '20px', flexShrink: 0, width: '28px', textAlign: 'center' }}>{driveIcon(file.mimeType)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: isFolder ? '600' : '400', color: isFolder ? '#1e293b' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.name}
                          </div>
                          {modified && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{modified}</div>}
                        </div>
                        {isFolder && <span style={{ color: '#94a3b8', fontSize: '18px', flexShrink: 0 }}>&rsaquo;</span>}
                        {!isFolder && <span style={{ color: '#94a3b8', fontSize: '11px', flexShrink: 0 }}>Open</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
