import React, { useState, useEffect } from 'react';
import Head from 'next/head';

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
  
  // UI state
  const [activeTab, setActiveTab] = useState('gantt');
  const [activeFinanceTab, setActiveFinanceTab] = useState('overview');
  
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

  // ============================================================
  // FINANCE DATA (hardcoded - future: connect to Google Sheets)
  // ============================================================
  const financeData = {
    // Budget period: Aug 2025 - Jul 2026
    monthLabels: ['Aug-25','Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26','Apr-26','May-26','Jun-26','Jul-26'],
    ytdMonths: 7, // Aug through Feb
    
    // Monthly budget by category (from drawdown Summary tab)
    staffingBudget:    [7579, 9579, 9579, 16954, 12954, 12954, 21154, 22004, 22004, 22004, 22004, 22004],
    directCostsBudget: [3200, 6575, 7339, 9307, 7257, 6845, 13604, 14736, 14736, 14736, 14736, 14736],
    overheadsBudget:   [1100, 1600, 1600, 1600, 1600, 1600, 400,   1600,  1600,  1600,  1600,  1600],
    
    // Monthly actuals by category (Nov-Feb only, first 3 months no spend)
    staffingActuals:    [0, 0, 0, 3500, 3500, 7200, 9800, 0, 0, 0, 0, 0],
    directCostsActuals: [0, 0, 0, 1200, 800, 2100, 3400, 0, 0, 0, 0, 0],
    overheadsActuals:   [0, 0, 0, 450, 380, 520, 610, 0, 0, 0, 0, 0],
    
    // Pipeline / Commitments
    pipeline: [
      { funder: 'National Lottery Community Fund', programme: 'Reaching Communities', amount: 343150, status: 'Awarded', probability: 100, type: 'committed' },
      { funder: 'Garfield Weston Foundation', programme: 'Regular Grants', amount: 50000, status: 'Application Submitted', probability: 40, type: 'pending' },
      { funder: 'Lloyds Bank Foundation', programme: 'Unrestricted Funding', amount: 75000, status: 'EOI Invited', probability: 30, type: 'pending' },
      { funder: 'Northern Rock Foundation', programme: 'Community Development', amount: 25000, status: 'Researching', probability: 20, type: 'prospective' },
      { funder: 'Community Foundation Tyne & Wear', programme: 'Grassroots Grants', amount: 15000, status: 'Researching', probability: 15, type: 'prospective' },
    ],
    
    // Cashflow
    openingBalance: 544,
    // Monthly net cashflow (income minus expenditure)
    monthlyNetCashflow: [0, 0, 0, 22710, 17130, 11079, 21348, 0, 0, 0, 0, 0],
    // Grant drawdown schedule (when money comes in)
    grantDrawdowns: [0, 0, 0, 28860, 21810, 21399, 35158, 58340, 58340, 0, 0, 0],
  };

  // Computed finance values
  const sumSlice = (arr, start, end) => arr.slice(start, end).reduce((a, b) => a + b, 0);
  const ytdBudget = sumSlice(financeData.staffingBudget, 0, 7) + sumSlice(financeData.directCostsBudget, 0, 7) + sumSlice(financeData.overheadsBudget, 0, 7);
  const ytdActuals = sumSlice(financeData.staffingActuals, 0, 7) + sumSlice(financeData.directCostsActuals, 0, 7) + sumSlice(financeData.overheadsActuals, 0, 7);
  const ytdVariance = ytdBudget - ytdActuals;
  const annualBudget = financeData.staffingBudget.reduce((a,b) => a+b, 0) + financeData.directCostsBudget.reduce((a,b) => a+b, 0) + financeData.overheadsBudget.reduce((a,b) => a+b, 0);
  
  const ytdStaffingBudget = sumSlice(financeData.staffingBudget, 0, 7);
  const ytdDirectCostsBudget = sumSlice(financeData.directCostsBudget, 0, 7);
  const ytdOverheadsBudget = sumSlice(financeData.overheadsBudget, 0, 7);
  const ytdStaffingActuals = sumSlice(financeData.staffingActuals, 0, 7);
  const ytdDirectCostsActuals = sumSlice(financeData.directCostsActuals, 0, 7);
  const ytdOverheadsActuals = sumSlice(financeData.overheadsActuals, 0, 7);

  // Cashflow running balance
  const cashflowBalance = [];
  let runningBalance = financeData.openingBalance;
  for (let i = 0; i < 12; i++) {
    const income = financeData.grantDrawdowns[i];
    const expenditure = (financeData.staffingActuals[i] + financeData.directCostsActuals[i] + financeData.overheadsActuals[i]);
    runningBalance = runningBalance + income - expenditure;
    cashflowBalance.push(runningBalance);
  }

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

  // Format currency helper
  const fmt = (val) => '£' + Math.round(val).toLocaleString('en-GB');
  const fmtPct = (val) => (val * 100).toFixed(1) + '%';

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
  // FINANCE TAB RENDER HELPERS
  // ============================================================
  const renderFinanceOverview = () => {
    const spendPct = ytdActuals / ytdBudget;
    const budgetCategories = [
      { name: 'Staffing', budget: ytdStaffingBudget, actual: ytdStaffingActuals, color: '#3b82f6' },
      { name: 'Direct Costs', budget: ytdDirectCostsBudget, actual: ytdDirectCostsActuals, color: '#10b981' },
      { name: 'Overheads', budget: ytdOverheadsBudget, actual: ytdOverheadsActuals, color: '#f59e0b' },
    ];

    return (
      <div>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'YTD Budget', value: fmt(ytdBudget), sub: 'Aug 25 – Feb 26 (7 months)', color: '#3b82f6' },
            { label: 'YTD Spend', value: fmt(ytdActuals), sub: fmtPct(spendPct) + ' of budget', color: '#10b981' },
            { label: 'YTD Variance', value: fmt(ytdVariance), sub: 'Under budget', color: '#f59e0b' },
            { label: 'Annual Budget', value: fmt(annualBudget), sub: 'Aug 25 – Jul 26', color: '#8b5cf6' },
          ].map((card, i) => (
            <div key={i} style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: `3px solid ${card.color}` }}>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{card.value}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* YTD Budget Breakdown */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>YTD Budget Breakdown</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Category</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Budget</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Spend</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Variance</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>% Spent</th>
              </tr>
            </thead>
            <tbody>
              {budgetCategories.map((cat, i) => {
                const variance = cat.budget - cat.actual;
                const pctSpent = cat.budget > 0 ? cat.actual / cat.budget : 0;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                      <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: cat.color, marginRight: '8px' }}></span>
                      {cat.name}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px', fontSize: '14px', color: '#334155' }}>{fmt(cat.budget)}</td>
                    <td style={{ textAlign: 'right', padding: '12px', fontSize: '14px', color: '#334155' }}>{fmt(cat.actual)}</td>
                    <td style={{ textAlign: 'right', padding: '12px', fontSize: '14px', color: variance >= 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>{fmt(variance)}</td>
                    <td style={{ textAlign: 'right', padding: '12px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <div style={{ width: '60px', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(pctSpent * 100, 100)}%`, height: '100%', backgroundColor: cat.color, borderRadius: '3px' }}></div>
                        </div>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>{fmtPct(pctSpent)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <td style={{ padding: '12px', fontSize: '14px', color: '#1e293b', fontWeight: '700' }}>Total</td>
                <td style={{ textAlign: 'right', padding: '12px', fontSize: '14px', color: '#1e293b', fontWeight: '700' }}>{fmt(ytdBudget)}</td>
                <td style={{ textAlign: 'right', padding: '12px', fontSize: '14px', color: '#1e293b', fontWeight: '700' }}>{fmt(ytdActuals)}</td>
                <td style={{ textAlign: 'right', padding: '12px', fontSize: '14px', color: '#10b981', fontWeight: '700' }}>{fmt(ytdVariance)}</td>
                <td style={{ textAlign: 'right', padding: '12px', fontSize: '14px', color: '#64748b', fontWeight: '600' }}>{fmtPct(ytdActuals / ytdBudget)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBudgetVsActuals = () => {
    const categories = [
      { name: 'Staffing', budget: financeData.staffingBudget, actuals: financeData.staffingActuals, color: '#3b82f6' },
      { name: 'Direct Costs', budget: financeData.directCostsBudget, actuals: financeData.directCostsActuals, color: '#10b981' },
      { name: 'Overheads', budget: financeData.overheadsBudget, actuals: financeData.overheadsActuals, color: '#f59e0b' },
    ];

    return (
      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'auto' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1e293b' }}>Monthly Budget vs Actuals</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>Aug 2025 – Feb 2026 (YTD)</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '13px', color: '#64748b', fontWeight: '600', position: 'sticky', left: 0, backgroundColor: '#f8fafc', minWidth: '120px' }}>Category</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '13px', color: '#64748b', fontWeight: '600', minWidth: '50px' }}>Type</th>
                {financeData.monthLabels.slice(0, 7).map((m, i) => (
                  <th key={i} style={{ textAlign: 'right', padding: '10px 8px', fontSize: '12px', color: '#64748b', fontWeight: '600', minWidth: '75px' }}>{m}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '13px', color: '#1e293b', fontWeight: '700', minWidth: '85px', backgroundColor: '#f1f5f9' }}>YTD Total</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, ci) => {
                const budgetTotal = sumSlice(cat.budget, 0, 7);
                const actualsTotal = sumSlice(cat.actuals, 0, 7);
                const varianceTotal = budgetTotal - actualsTotal;
                return (
                  <React.Fragment key={ci}>
                    {/* Budget row */}
                    <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: ci % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td rowSpan={3} style={{ padding: '10px 12px', fontSize: '14px', color: '#334155', fontWeight: '600', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'sticky', left: 0, backgroundColor: ci % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', backgroundColor: cat.color, marginRight: '6px' }}></span>
                        {cat.name}
                      </td>
                      <td style={{ padding: '8px', fontSize: '12px', color: '#64748b' }}>Budget</td>
                      {cat.budget.slice(0, 7).map((v, i) => (
                        <td key={i} style={{ textAlign: 'right', padding: '8px', fontSize: '13px', color: '#475569' }}>{fmt(v)}</td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '8px 12px', fontSize: '13px', fontWeight: '600', color: '#1e293b', backgroundColor: '#f1f5f9' }}>{fmt(budgetTotal)}</td>
                    </tr>
                    {/* Actuals row */}
                    <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: ci % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={{ padding: '8px', fontSize: '12px', color: '#64748b' }}>Actual</td>
                      {cat.actuals.slice(0, 7).map((v, i) => (
                        <td key={i} style={{ textAlign: 'right', padding: '8px', fontSize: '13px', color: v > 0 ? '#334155' : '#cbd5e1' }}>{fmt(v)}</td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '8px 12px', fontSize: '13px', fontWeight: '600', color: '#1e293b', backgroundColor: '#f1f5f9' }}>{fmt(actualsTotal)}</td>
                    </tr>
                    {/* Variance row */}
                    <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: ci % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={{ padding: '8px', fontSize: '12px', color: '#64748b' }}>Variance</td>
                      {cat.budget.slice(0, 7).map((b, i) => {
                        const v = b - cat.actuals[i];
                        return <td key={i} style={{ textAlign: 'right', padding: '8px', fontSize: '13px', color: v >= 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>{fmt(v)}</td>;
                      })}
                      <td style={{ textAlign: 'right', padding: '8px 12px', fontSize: '13px', fontWeight: '700', color: varianceTotal >= 0 ? '#10b981' : '#ef4444', backgroundColor: '#f1f5f9' }}>{fmt(varianceTotal)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {/* Grand total row */}
              <tr style={{ backgroundColor: '#f1f5f9', borderTop: '3px solid #cbd5e1' }}>
                <td style={{ padding: '12px', fontSize: '14px', fontWeight: '700', color: '#1e293b', position: 'sticky', left: 0, backgroundColor: '#f1f5f9' }}>Total</td>
                <td style={{ padding: '8px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Budget</td>
                {financeData.monthLabels.slice(0, 7).map((_, i) => {
                  const total = financeData.staffingBudget[i] + financeData.directCostsBudget[i] + financeData.overheadsBudget[i];
                  return <td key={i} style={{ textAlign: 'right', padding: '10px 8px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{fmt(total)}</td>;
                })}
                <td style={{ textAlign: 'right', padding: '10px 12px', fontSize: '14px', fontWeight: '700', color: '#1e293b', backgroundColor: '#e2e8f0' }}>{fmt(ytdBudget)}</td>
              </tr>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <td style={{ padding: '12px', position: 'sticky', left: 0, backgroundColor: '#f1f5f9' }}></td>
                <td style={{ padding: '8px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Actual</td>
                {financeData.monthLabels.slice(0, 7).map((_, i) => {
                  const total = financeData.staffingActuals[i] + financeData.directCostsActuals[i] + financeData.overheadsActuals[i];
                  return <td key={i} style={{ textAlign: 'right', padding: '10px 8px', fontSize: '13px', fontWeight: '700', color: total > 0 ? '#1e293b' : '#cbd5e1' }}>{fmt(total)}</td>;
                })}
                <td style={{ textAlign: 'right', padding: '10px 12px', fontSize: '14px', fontWeight: '700', color: '#1e293b', backgroundColor: '#e2e8f0' }}>{fmt(ytdActuals)}</td>
              </tr>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <td style={{ padding: '12px', position: 'sticky', left: 0, backgroundColor: '#f1f5f9' }}></td>
                <td style={{ padding: '8px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Variance</td>
                {financeData.monthLabels.slice(0, 7).map((_, i) => {
                  const bTotal = financeData.staffingBudget[i] + financeData.directCostsBudget[i] + financeData.overheadsBudget[i];
                  const aTotal = financeData.staffingActuals[i] + financeData.directCostsActuals[i] + financeData.overheadsActuals[i];
                  const v = bTotal - aTotal;
                  return <td key={i} style={{ textAlign: 'right', padding: '10px 8px', fontSize: '13px', fontWeight: '700', color: v >= 0 ? '#10b981' : '#ef4444' }}>{fmt(v)}</td>;
                })}
                <td style={{ textAlign: 'right', padding: '10px 12px', fontSize: '14px', fontWeight: '700', color: ytdVariance >= 0 ? '#10b981' : '#ef4444', backgroundColor: '#e2e8f0' }}>{fmt(ytdVariance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPipeline = () => {
    const committed = financeData.pipeline.filter(p => p.type === 'committed');
    const pending = financeData.pipeline.filter(p => p.type === 'pending');
    const prospective = financeData.pipeline.filter(p => p.type === 'prospective');
    const totalPipeline = financeData.pipeline.reduce((a, p) => a + p.amount, 0);
    const weightedPipeline = financeData.pipeline.reduce((a, p) => a + (p.amount * p.probability / 100), 0);

    const statusColor = { 'Awarded': '#10b981', 'Application Submitted': '#3b82f6', 'EOI Invited': '#f59e0b', 'Researching': '#94a3b8' };

    const renderGroup = (title, items, bgColor) => (
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h4>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: bgColor, borderRadius: '6px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{item.funder}</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{item.programme}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '500', backgroundColor: `${statusColor[item.status] || '#94a3b8'}15`, color: statusColor[item.status] || '#475569' }}>
                {item.status}
              </span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{fmt(item.amount)}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.probability}% probability</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );

    return (
      <div>
        {/* Pipeline Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '18px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '3px solid #10b981' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Committed</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>{fmt(committed.reduce((a, p) => a + p.amount, 0))}</div>
          </div>
          <div style={{ padding: '18px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '3px solid #3b82f6' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Pending</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>{fmt(pending.reduce((a, p) => a + p.amount, 0))}</div>
          </div>
          <div style={{ padding: '18px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '3px solid #f59e0b' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Prospective</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>{fmt(prospective.reduce((a, p) => a + p.amount, 0))}</div>
          </div>
          <div style={{ padding: '18px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '3px solid #8b5cf6' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Weighted Pipeline</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>{fmt(weightedPipeline)}</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
          {renderGroup('Committed Funding', committed, '#f0fdf4')}
          {renderGroup('Pending Applications', pending, '#eff6ff')}
          {renderGroup('Prospective Opportunities', prospective, '#fafafa')}
        </div>
      </div>
    );
  };

  const renderCashflow = () => {
    return (
      <div>
        {/* Cashflow KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '3px solid #3b82f6' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Opening Balance</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{fmt(financeData.openingBalance)}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>1 Aug 2025</div>
          </div>
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '3px solid #10b981' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Current Balance</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: cashflowBalance[6] >= 0 ? '#1e293b' : '#ef4444' }}>{fmt(cashflowBalance[6])}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>End Feb 2026</div>
          </div>
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '3px solid #f59e0b' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>Total Drawdowns</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{fmt(sumSlice(financeData.grantDrawdowns, 0, 7))}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>YTD received</div>
          </div>
        </div>

        {/* Cashflow Table */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'auto' }}>
          <div style={{ padding: '20px 24px 0' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1e293b' }}>Monthly Cashflow</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>Aug 2025 – Jul 2026</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '13px', color: '#64748b', fontWeight: '600', position: 'sticky', left: 0, backgroundColor: '#f8fafc', minWidth: '130px' }}></th>
                  {financeData.monthLabels.map((m, i) => (
                    <th key={i} style={{ textAlign: 'right', padding: '10px 8px', fontSize: '12px', color: i < 7 ? '#1e293b' : '#94a3b8', fontWeight: i < 7 ? '600' : '400', minWidth: '75px' }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: '500', color: '#334155', position: 'sticky', left: 0, backgroundColor: 'white' }}>Grant Drawdowns</td>
                  {financeData.grantDrawdowns.map((v, i) => (
                    <td key={i} style={{ textAlign: 'right', padding: '10px 8px', fontSize: '13px', color: v > 0 ? '#10b981' : '#cbd5e1', fontWeight: v > 0 ? '500' : '400' }}>{v > 0 ? fmt(v) : '–'}</td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafbfc' }}>
                  <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: '500', color: '#334155', position: 'sticky', left: 0, backgroundColor: '#fafbfc' }}>Total Expenditure</td>
                  {financeData.monthLabels.map((_, i) => {
                    const exp = financeData.staffingActuals[i] + financeData.directCostsActuals[i] + financeData.overheadsActuals[i];
                    return <td key={i} style={{ textAlign: 'right', padding: '10px 8px', fontSize: '13px', color: exp > 0 ? '#ef4444' : '#cbd5e1', fontWeight: exp > 0 ? '500' : '400' }}>{exp > 0 ? '-' + fmt(exp) : '–'}</td>;
                  })}
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: '500', color: '#334155', position: 'sticky', left: 0, backgroundColor: 'white' }}>Net Cashflow</td>
                  {financeData.monthLabels.map((_, i) => {
                    const income = financeData.grantDrawdowns[i];
                    const exp = financeData.staffingActuals[i] + financeData.directCostsActuals[i] + financeData.overheadsActuals[i];
                    const net = income - exp;
                    return <td key={i} style={{ textAlign: 'right', padding: '10px 8px', fontSize: '13px', color: net > 0 ? '#10b981' : net < 0 ? '#ef4444' : '#cbd5e1', fontWeight: net !== 0 ? '600' : '400' }}>{net !== 0 ? fmt(net) : '–'}</td>;
                  })}
                </tr>
                <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                  <td style={{ padding: '12px', fontSize: '14px', fontWeight: '700', color: '#1e293b', position: 'sticky', left: 0, backgroundColor: '#f1f5f9' }}>Closing Balance</td>
                  {cashflowBalance.map((v, i) => (
                    <td key={i} style={{ textAlign: 'right', padding: '12px 8px', fontSize: '14px', fontWeight: '700', color: v >= 0 ? '#1e293b' : '#ef4444' }}>{fmt(v)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <>
      <Head>
        <title>TPW Regional Delivery Action Plan</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
                  : 'Start dates are estimated as 3 months before each deadline for visualization purposes.'}
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
                                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#f0f9ff'; }}
                                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; }}
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
          {/* FINANCE TAB */}
          {/* ============================================================ */}
          {activeTab === 'finance' && (
            <>
              {/* Finance Sub-tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'bva', label: 'Budget vs Actuals' },
                  { id: 'pipeline', label: 'Pipeline' },
                  { id: 'cashflow', label: 'Cashflow' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveFinanceTab(tab.id)}
                    style={{
                      padding: '10px 20px', fontSize: '14px', fontWeight: '500',
                      border: '1px solid', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                      borderColor: activeFinanceTab === tab.id ? '#3b82f6' : '#e2e8f0',
                      backgroundColor: activeFinanceTab === tab.id ? '#3b82f6' : 'white',
                      color: activeFinanceTab === tab.id ? 'white' : '#475569',
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeFinanceTab === 'overview' && renderFinanceOverview()}
              {activeFinanceTab === 'bva' && renderBudgetVsActuals()}
              {activeFinanceTab === 'pipeline' && renderPipeline()}
              {activeFinanceTab === 'cashflow' && renderCashflow()}

              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px', fontSize: '14px', color: '#0369a1' }}>
                <strong>Note:</strong> Financial data is currently manually maintained. Budget figures sourced from NLCF Year 1 drawdown workbook Summary tab. Actuals cover Nov 2025 – Feb 2026 transaction period.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
