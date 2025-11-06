import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
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
        
        // Initialize milestone priority filter (all selected)
        const allPriorities = new Set(
          (data.milestones || [])
            .map(m => m.fields[data.config.milestone_priority_name_field || 'Priority']?.[0])
            .filter(Boolean)
        );
        setSelectedPriorities(allPriorities);
        
        // Initialize milestone status filter (all selected)
        const allMilestoneStatuses = new Set(
          (data.milestones || [])
            .map(m => m.fields[data.config.milestone_status_field || 'Status'])
            .filter(Boolean)
        );
        setSelectedStatuses(allMilestoneStatuses);
        
        // Initialize milestone accountable filter (all selected)
        const allAccountable = new Set(
          (data.milestones || [])
            .map(m => {
              const accountableIds = m.fields[data.config.milestone_accountable_field || 'Accountable'];
              return accountableIds?.[0];
            })
            .filter(Boolean)
            .map(id => data.peopleMap[id])
            .filter(Boolean)
        );
        setSelectedAccountable(allAccountable);
        
        // Initialize action responsible filter (all selected, only Current TPW Role)
        const allResponsible = new Set(
          (data.actions || [])
            .filter(a => (a.fields[data.config.action_tpw_role_field || 'Current Status (TPW Role)'] || '') === 'Current')
            .map(a => {
              const responsibleIds = a.fields[data.config.action_responsible_field || 'Responsible'];
              return responsibleIds?.[0];
            })
            .filter(Boolean)
            .map(id => data.peopleMap[id])
            .filter(Boolean)
        );
        setSelectedResponsible(allResponsible);
        
        // Initialize action status filter (all selected, only Current TPW Role)
        const allActionStatuses = new Set(
          (data.actions || [])
            .filter(a => (a.fields[data.config.action_tpw_role_field || 'Current Status (TPW Role)'] || '') === 'Current')
            .map(a => a.fields[data.config.action_status_field || 'Status'])
            .filter(Boolean)
        );
        setSelectedActionStatuses(allActionStatuses);
        
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

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

  // Get field names from config with fallbacks
  const MILESTONE_NAME_FIELD = config.milestone_name_field || 'Name';
  const MILESTONE_DEADLINE_FIELD = config.milestone_deadline_field || 'Deadline';
  const MILESTONE_PRIORITY_ID_FIELD = config.milestone_priority_id_field || 'Priority area';
  const MILESTONE_PRIORITY_NAME_FIELD = config.milestone_priority_name_field || 'Priority';
  const MILESTONE_ACTIVITIES_FIELD = config.milestone_activities_field || 'Activities';
  const MILESTONE_START_FIELD = config.milestone_start_field || 'Start Date';
  const MILESTONE_ACCOUNTABLE_FIELD = config.milestone_accountable_field || 'Accountable';
  const MILESTONE_STATUS_FIELD = config.milestone_status_field || 'Status';
  
  const ACTION_NAME_FIELD = config.action_name_field || 'Name';
  const ACTION_RESPONSIBLE_FIELD = config.action_responsible_field || 'Responsible';
  const ACTION_DEADLINE_FIELD = config.action_deadline_field || 'Deadline';
  const ACTION_STATUS_FIELD = config.action_status_field || 'Status';
  const ACTION_TPW_ROLE_FIELD = config.action_tpw_role_field || 'Current Status (TPW Role)';

  // Process milestones data for Gantt chart
  const chartData = milestones.map(milestone => {
    const name = milestone.fields[MILESTONE_NAME_FIELD] || 'Unnamed Activity';
    const deadline = milestone.fields[MILESTONE_DEADLINE_FIELD] || '';
    const startDateField = milestone.fields[MILESTONE_START_FIELD] || '';
    
    // Use priority name field directly instead of looking up by ID
    const priority = milestone.fields[MILESTONE_PRIORITY_NAME_FIELD]?.[0] || 'No Priority';
    
    const status = milestone.fields[MILESTONE_STATUS_FIELD] || 'No Status';
    const accountableIds = milestone.fields[MILESTONE_ACCOUNTABLE_FIELD];
    const accountableId = accountableIds?.[0];
    const accountable = accountableId ? (peopleMap[accountableId] || 'Unassigned') : 'Unassigned';
    
    // Use actual start date if available, otherwise estimate
    let startDate;
    if (startDateField) {
      startDate = new Date(startDateField);
    } else {
      const deadlineDate = new Date(deadline);
      startDate = new Date(deadlineDate);
      startDate.setMonth(startDate.getMonth() - 3);
    }
    
    const deadlineDate = new Date(deadline);
    
    return {
      id: milestone.id,
      name,
      priority,
      status,
      accountable,
      start: startDate,
      end: deadlineDate,
      deadline,
      hasStartDate: !!startDateField
    };
  });
  
  // Debug logging
  console.log('=== GANTT CHART DEBUG ===');
  console.log('Total milestones:', chartData.length);
  console.log('Sample milestone:', chartData[0]);
  console.log('All priorities:', [...new Set(chartData.map(m => m.priority))]);
  console.log('All accountable people:', [...new Set(chartData.map(m => m.accountable))]);
  console.log('All statuses:', [...new Set(chartData.map(m => m.status))]);
  console.log('Selected priorities:', Array.from(selectedPriorities));
  console.log('Selected accountable:', Array.from(selectedAccountable));
  console.log('Selected statuses:', Array.from(selectedStatuses));
  console.log('accountablePeople array:', accountablePeople);
  
  const filteredChartData = chartData
    .filter(item => item.deadline)
    .filter(item => selectedPriorities.has(item.priority))
    .filter(item => selectedStatuses.has(item.status))
    .filter(item => selectedAccountable.has(item.accountable));
  
  console.log('After filters:', filteredChartData.length);

  // Sort by deadline if enabled
  let sortedData = [...filteredChartData];
  if (sortByDeadline) {
    sortedData.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  // Get unique values for filters
  const priorities = [...new Set(milestones.map(m => 
    m.fields[MILESTONE_PRIORITY_NAME_FIELD]?.[0]
  ).filter(Boolean))].sort();

  const milestoneStatuses = [...new Set(milestones.map(m => 
    m.fields[MILESTONE_STATUS_FIELD]
  ).filter(Boolean))].sort();

  const accountablePeople = [...new Set(milestones.map(m => {
    const accountableIds = m.fields[MILESTONE_ACCOUNTABLE_FIELD];
    const accountableId = accountableIds?.[0];
    return accountableId ? peopleMap[accountableId] : null;
  }).filter(Boolean))].sort();

  // Organize data by priority if grouping is enabled
  const organizedData = groupByPriority
    ? priorities
        .filter(priority => selectedPriorities.has(priority))
        .map(priority => ({
          priority,
          items: sortedData.filter(item => item.priority === priority)
        }))
        .filter(group => group.items.length > 0)
    : [{ priority: null, items: sortedData }];

  // Priority toggle functions
  const togglePriority = (priority) => {
    const newSelected = new Set(selectedPriorities);
    if (newSelected.has(priority)) {
      newSelected.delete(priority);
    } else {
      newSelected.add(priority);
    }
    setSelectedPriorities(newSelected);
  };

  const selectAllPriorities = () => {
    setSelectedPriorities(new Set(priorities));
  };

  const deselectAllPriorities = () => {
    setSelectedPriorities(new Set());
  };

  // Status toggle functions
  const toggleStatus = (status) => {
    const newSelected = new Set(selectedStatuses);
    if (newSelected.has(status)) {
      newSelected.delete(status);
    } else {
      newSelected.add(status);
    }
    setSelectedStatuses(newSelected);
  };

  const selectAllStatuses = () => {
    setSelectedStatuses(new Set(milestoneStatuses));
  };

  const deselectAllStatuses = () => {
    setSelectedStatuses(new Set());
  };

  // Accountable toggle functions
  const toggleAccountable = (person) => {
    const newSelected = new Set(selectedAccountable);
    if (newSelected.has(person)) {
      newSelected.delete(person);
    } else {
      newSelected.add(person);
    }
    setSelectedAccountable(newSelected);
  };

  const selectAllAccountable = () => {
    setSelectedAccountable(new Set(accountablePeople));
  };

  const deselectAllAccountable = () => {
    setSelectedAccountable(new Set());
  };

  // Priority colors
  const priorityColors = {
    '1. Governance and Leadership': '#3b82f6', // blue
    '2. Grant making [national perspective approach for Year 1] ': '#10b981', // green
    '3. Infrastructure capability support and development': '#eab308', // yellow
    '4. Learning and Impact': '#ef4444' // red
  };

  // Calculate timeline bounds for Gantt
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

  const getPosition = (date) => {
    const days = (date - minDate) / (1000 * 60 * 60 * 24);
    return (days / totalDays) * 100;
  };

  const formatMonth = (date) => {
    return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  };

  // Process actions data
  const processedActions = actions.map(action => {
    const responsibleIds = action.fields[ACTION_RESPONSIBLE_FIELD];
    const responsibleId = responsibleIds?.[0];
    const responsibleName = responsibleId ? (peopleMap[responsibleId] || 'Unknown') : 'Unassigned';
    const tpwRole = action.fields[ACTION_TPW_ROLE_FIELD] || '';
    
    return {
      id: action.id,
      name: action.fields[ACTION_NAME_FIELD] || 'Unnamed Action',
      responsible: responsibleName,
      deadline: action.fields[ACTION_DEADLINE_FIELD] || '',
      status: action.fields[ACTION_STATUS_FIELD] || 'No Status',
      tpwRole: tpwRole
    };
  });

  // Debug logging
  console.log('Total actions:', processedActions.length);
  console.log('Actions with TPW Role "Current":', processedActions.filter(a => a.tpwRole === 'Current').length);
  console.log('Sample action:', processedActions[0]);
  console.log('All responsible people:', [...new Set(processedActions.map(a => a.responsible))]);
  console.log('Adebayo actions:', processedActions.filter(a => a.responsible.includes('Adebayo') || a.responsible.includes('Obasaju') || a.responsible.includes('Bayo')));
  console.log('People Map:', peopleMap);
  console.log('Selected Responsible:', Array.from(selectedResponsible));
  
  const filteredActions = processedActions
    .filter(action => action.name !== 'Unnamed Action')
    .filter(action => action.tpwRole === 'Current') // Only show actions where TPW Role is 'Current'
    .filter(action => selectedResponsible.has(action.responsible))
    .filter(action => selectedActionStatuses.has(action.status));

  // Sort actions by deadline
  let sortedActions = [...filteredActions].sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  // Get unique responsible people and statuses for Actions filters (only for Current TPW Role)
  const allResponsiblePeople = [...new Set(actions
    .filter(a => (a.fields[ACTION_TPW_ROLE_FIELD] || '') === 'Current')
    .map(a => {
      const responsibleIds = a.fields[ACTION_RESPONSIBLE_FIELD];
      const responsibleId = responsibleIds?.[0];
      return responsibleId ? peopleMap[responsibleId] : null;
    })
    .filter(Boolean)
  )].sort();
  
  const allActionStatuses = [...new Set(actions
    .filter(a => (a.fields[ACTION_TPW_ROLE_FIELD] || '') === 'Current')
    .map(a => a.fields[ACTION_STATUS_FIELD])
    .filter(Boolean)
  )].sort();

  // Status color mapping
  const statusColors = {
    'Not started': '#94a3b8', // gray
    'In progress': '#3b82f6', // blue  
    'Complete': '#10b981', // green
    'On hold': '#f59e0b', // orange
    'Cancelled': '#ef4444' // red
  };

  // Group actions by responsible or status
  let organizedActions;
  if (groupByStatus) {
    organizedActions = allActionStatuses
      .filter(status => selectedActionStatuses.has(status))
      .map(status => ({
        groupName: status,
        groupType: 'status',
        items: sortedActions.filter(a => a.status === status)
      }))
      .filter(group => group.items.length > 0);
  } else if (groupByResponsible) {
    organizedActions = allResponsiblePeople
      .filter(person => selectedResponsible.has(person))
      .map(responsible => ({
        groupName: responsible,
        groupType: 'responsible',
        items: sortedActions.filter(a => a.responsible === responsible)
      }))
      .filter(group => group.items.length > 0);
  } else {
    organizedActions = [{ groupName: null, groupType: null, items: sortedActions }];
  }

  // Responsible toggle functions
  const toggleResponsible = (person) => {
    const newSelected = new Set(selectedResponsible);
    if (newSelected.has(person)) {
      newSelected.delete(person);
    } else {
      newSelected.add(person);
    }
    setSelectedResponsible(newSelected);
  };

  const selectAllResponsible = () => {
    setSelectedResponsible(new Set(allResponsiblePeople));
  };

  const deselectAllResponsible = () => {
    setSelectedResponsible(new Set());
  };

  // Action status toggle functions
  const toggleActionStatus = (status) => {
    const newSelected = new Set(selectedActionStatuses);
    if (newSelected.has(status)) {
      newSelected.delete(status);
    } else {
      newSelected.add(status);
    }
    setSelectedActionStatuses(newSelected);
  };

  const selectAllActionStatuses = () => {
    setSelectedActionStatuses(new Set(allActionStatuses));
  };

  const deselectAllActionStatuses = () => {
    setSelectedActionStatuses(new Set());
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

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
          <div style={{ 
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            borderBottom: '2px solid #e2e8f0'
          }}>
            <button
              onClick={() => setActiveTab('gantt')}
              style={{
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: '600',
                border: 'none',
                borderBottom: activeTab === 'gantt' ? '3px solid #3b82f6' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'gantt' ? '#3b82f6' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Gantt Chart
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              style={{
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: '600',
                border: 'none',
                borderBottom: activeTab === 'actions' ? '3px solid #3b82f6' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'actions' ? '#3b82f6' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Actions
            </button>
          </div>

          {/* Gantt Chart Tab */}
          {activeTab === 'gantt' && (
            <>
              {/* Priority Filter */}
              <div style={{ 
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>
                    Filter by Priority Area:
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={selectAllPriorities}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllPriorities}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {priorities.map(priority => {
                    const isSelected = selectedPriorities.has(priority);
                    return (
                      <label 
                        key={priority} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: isSelected ? priorityColors[priority] || '#94a3b8' : '#e2e8f0',
                          backgroundColor: isSelected ? `${priorityColors[priority] || '#94a3b8'}10` : 'white',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePriority(priority)}
                          style={{ 
                            width: '16px', 
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: priorityColors[priority] || '#94a3b8'
                          }}
                        />
                        <div style={{ 
                          width: '12px', 
                          height: '12px', 
                          backgroundColor: priorityColors[priority] || '#94a3b8',
                          borderRadius: '2px',
                          opacity: isSelected ? 1 : 0.3
                        }} />
                        <span style={{ 
                          fontSize: '14px', 
                          color: isSelected ? '#1e293b' : '#94a3b8',
                          fontWeight: isSelected ? '500' : '400'
                        }}>
                          {priority}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Filter */}
              <div style={{ 
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>
                    Filter by Status:
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={selectAllStatuses}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllStatuses}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {milestoneStatuses.map(status => {
                    const isSelected = selectedStatuses.has(status);
                    return (
                      <label 
                        key={status} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: isSelected ? '#8b5cf6' : '#e2e8f0',
                          backgroundColor: isSelected ? '#f5f3ff' : 'white',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStatus(status)}
                          style={{ 
                            width: '16px', 
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#8b5cf6'
                          }}
                        />
                        <span style={{ 
                          fontSize: '14px', 
                          color: isSelected ? '#1e293b' : '#94a3b8',
                          fontWeight: isSelected ? '500' : '400'
                        }}>
                          {status}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Accountable Filter */}
              <div style={{ 
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>
                    Filter by Accountable:
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={selectAllAccountable}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllAccountable}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {accountablePeople.map(person => {
                    const isSelected = selectedAccountable.has(person);
                    return (
                      <label 
                        key={person} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: isSelected ? '#06b6d4' : '#e2e8f0',
                          backgroundColor: isSelected ? '#ecfeff' : 'white',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAccountable(person)}
                          style={{ 
                            width: '16px', 
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#06b6d4'
                          }}
                        />
                        <span style={{ 
                          fontSize: '14px', 
                          color: isSelected ? '#1e293b' : '#94a3b8',
                          fontWeight: isSelected ? '500' : '400'
                        }}>
                          {person}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* View Options */}
              <div style={{ 
                display: 'flex', 
                gap: '15px', 
                marginBottom: '20px',
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '600', color: '#1e293b', marginRight: '10px' }}>
                  View Options:
                </span>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={groupByPriority}
                    onChange={(e) => setGroupByPriority(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#475569' }}>Group by Priority</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={sortByDeadline}
                    onChange={(e) => setSortByDeadline(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#475569' }}>Sort by Deadline</span>
                </label>
              </div>

              {/* Gantt Chart */}
              <div style={{ 
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                {/* Timeline Header */}
                <div style={{ 
                  display: 'flex',
                  borderBottom: '2px solid #e2e8f0',
                  backgroundColor: '#f8fafc'
                }}>
                  <div style={{ 
                    width: '300px', 
                    padding: '12px 16px',
                    fontWeight: '600',
                    color: '#1e293b',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    Activity
                  </div>
                  <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                    {months.map((month, idx) => (
                      <div 
                        key={idx}
                        style={{
                          flex: 1,
                          padding: '12px 8px',
                          textAlign: 'center',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#64748b',
                          borderRight: idx < months.length - 1 ? '1px solid #e2e8f0' : 'none'
                        }}
                      >
                        {formatMonth(month)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gantt Rows */}
                {organizedData.map((group, groupIdx) => (
                  <div key={groupIdx}>
                    {groupByPriority && (
                      <div style={{
                        display: 'flex',
                        backgroundColor: '#f1f5f9',
                        borderBottom: '2px solid #cbd5e1',
                        fontWeight: '600',
                        fontSize: '14px',
                        color: '#334155',
                        padding: '12px 16px',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                      }}>
                        <div style={{ width: '300px', borderRight: '1px solid #cbd5e1' }}>
                          {group.priority}
                        </div>
                        <div style={{ flex: 1, paddingLeft: '16px', color: '#64748b' }}>
                          {group.items.length} milestone{group.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                    
                    {group.items.map((item, idx) => (
                      <div 
                        key={item.id}
                        style={{ 
                          display: 'flex',
                          borderBottom: '1px solid #e2e8f0',
                          minHeight: '60px',
                          alignItems: 'center',
                          backgroundColor: idx % 2 === 0 ? 'white' : '#fafbfc'
                        }}
                      >
                        <div style={{ 
                          width: '300px', 
                          padding: '12px 16px',
                          borderRight: '1px solid #e2e8f0',
                          fontSize: '14px',
                          color: '#334155',
                          lineHeight: '1.4'
                        }}>
                          <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                            {item.name}
                          </div>
                          {!groupByPriority && (
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              {item.priority}
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, position: 'relative', padding: '8px 0' }}>
                          <div style={{ 
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex'
                          }}>
                            {months.map((_, idx) => (
                              <div 
                                key={idx}
                                style={{
                                  flex: 1,
                                  borderRight: idx < months.length - 1 ? '1px solid #f1f5f9' : 'none'
                                }}
                              />
                            ))}
                          </div>
                          
                          <div style={{
                            position: 'absolute',
                            left: `${getPosition(item.start)}%`,
                            width: `${getPosition(item.end) - getPosition(item.start)}%`,
                            height: '32px',
                            backgroundColor: priorityColors[item.priority] || '#94a3b8',
                            borderRadius: '4px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            color: 'white',
                            fontWeight: '500',
                            padding: '0 8px',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis'
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
              <div style={{ 
                marginTop: '30px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px'
              }}>
                <div style={{ 
                  padding: '20px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
                    Total Milestones {(selectedPriorities.size < priorities.length || selectedStatuses.size < milestoneStatuses.length || selectedAccountable.size < accountablePeople.length) ? '(Filtered)' : ''}
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
                    {filteredChartData.length}
                  </div>
                </div>
                {priorities.filter(p => selectedPriorities.has(p)).map(priority => {
                  const count = filteredChartData.filter(item => item.priority === priority).length;
                  return (
                    <div key={priority} style={{ 
                      padding: '20px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
                        {priority}
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: '700', color: priorityColors[priority] }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ 
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#0369a1'
              }}>
                <strong>Note:</strong> {chartData.some(item => item.hasStartDate) 
                  ? 'Milestones with start dates show actual duration. Others estimate 3 months before deadline.'
                  : 'Start dates are estimated as 3 months before each deadline for visualization purposes.'}
                {' '}Data synced from Airtable in real-time.
              </div>
            </>
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <>
              {/* Filter by Responsible */}
              <div style={{ 
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>
                    Filter by Responsible:
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={selectAllResponsible}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllResponsible}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {allResponsiblePeople.map(person => {
                    const isSelected = selectedResponsible.has(person);
                    return (
                      <label 
                        key={person} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: isSelected ? '#3b82f6' : '#e2e8f0',
                          backgroundColor: isSelected ? '#eff6ff' : 'white',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleResponsible(person)}
                          style={{ 
                            width: '16px', 
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#3b82f6'
                          }}
                        />
                        <span style={{ 
                          fontSize: '14px', 
                          color: isSelected ? '#1e293b' : '#94a3b8',
                          fontWeight: isSelected ? '500' : '400'
                        }}>
                          {person}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Filter by Status */}
              <div style={{ 
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>
                    Filter by Status:
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={selectAllActionStatuses}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllActionStatuses}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {allActionStatuses.map(status => {
                    const isSelected = selectedActionStatuses.has(status);
                    return (
                      <label 
                        key={status} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: isSelected ? '#10b981' : '#e2e8f0',
                          backgroundColor: isSelected ? '#f0fdf4' : 'white',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleActionStatus(status)}
                          style={{ 
                            width: '16px', 
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#10b981'
                          }}
                        />
                        <span style={{ 
                          fontSize: '14px', 
                          color: isSelected ? '#1e293b' : '#94a3b8',
                          fontWeight: isSelected ? '500' : '400'
                        }}>
                          {status}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* View Options */}
              <div style={{ 
                display: 'flex', 
                gap: '15px', 
                marginBottom: '20px',
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '600', color: '#1e293b', marginRight: '10px' }}>
                  View Options:
                </span>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={groupByResponsible}
                    onChange={(e) => {
                      setGroupByResponsible(e.target.checked);
                      if (e.target.checked) setGroupByStatus(false);
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#475569' }}>Group by Responsible</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={groupByStatus}
                    onChange={(e) => {
                      setGroupByStatus(e.target.checked);
                      if (e.target.checked) setGroupByResponsible(false);
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#475569' }}>Group by Status</span>
                </label>
                
                <div style={{ 
                  marginLeft: 'auto',
                  padding: '6px 12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#0369a1',
                  fontWeight: '500'
                }}>
                  Sorted by: Deadline (earliest first)
                </div>
              </div>

              {/* Actions Table */}
              <div style={{ 
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                {/* Table Header */}
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  borderBottom: '2px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#1e293b'
                }}>
                  <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>
                    Name
                  </div>
                  <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>
                    Responsible
                  </div>
                  <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>
                    Deadline
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    Status
                  </div>
                </div>

                {/* Table Rows */}
                {organizedActions.map((group, groupIdx) => (
                  <div key={groupIdx}>
                    {(groupByResponsible || groupByStatus) && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr',
                        backgroundColor: '#f1f5f9',
                        borderBottom: '2px solid #cbd5e1',
                        fontWeight: '600',
                        fontSize: '14px',
                        color: '#334155',
                        padding: '12px 16px'
                      }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                          {group.groupName} ({group.items.length} action{group.items.length !== 1 ? 's' : ''})
                        </div>
                      </div>
                    )}
                    
                    {group.items.map((action, idx) => (
                      <div 
                        key={action.id}
                        style={{ 
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr',
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: idx % 2 === 0 ? 'white' : '#fafbfc'
                        }}
                      >
                        <div style={{ 
                          padding: '12px 16px',
                          borderRight: '1px solid #e2e8f0',
                          fontSize: '14px',
                          color: '#334155'
                        }}>
                          {action.name}
                        </div>
                        <div style={{ 
                          padding: '12px 16px',
                          borderRight: '1px solid #e2e8f0',
                          fontSize: '14px',
                          color: groupByResponsible ? '#64748b' : '#334155'
                        }}>
                          {groupByResponsible ? '' : action.responsible}
                        </div>
                        <div style={{ 
                          padding: '12px 16px',
                          borderRight: '1px solid #e2e8f0',
                          fontSize: '14px',
                          color: '#334155'
                        }}>
                          {formatDate(action.deadline)}
                        </div>
                        <div style={{ 
                          padding: '12px 16px',
                          fontSize: '14px'
                        }}>
                          {groupByStatus ? (
                            <span style={{ color: '#64748b' }}></span>
                          ) : (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: '500',
                              backgroundColor: `${statusColors[action.status] || '#94a3b8'}20`,
                              color: statusColors[action.status] || '#334155',
                              display: 'inline-block'
                            }}>
                              {action.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Actions Summary */}
              <div style={{ 
                marginTop: '20px',
                padding: '20px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
                  Total Actions {(selectedResponsible.size < allResponsiblePeople.length || selectedActionStatuses.size < allActionStatuses.length) ? '(Filtered)' : ''}
                </div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
                  {filteredActions.length}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
