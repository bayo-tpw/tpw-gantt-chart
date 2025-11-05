import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [milestones, setMilestones] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupByPriority, setGroupByPriority] = useState(true);
  const [sortByDeadline, setSortByDeadline] = useState(false);
  const [selectedPriorities, setSelectedPriorities] = useState(new Set());
  const [activeTab, setActiveTab] = useState('gantt');
  const [groupByResponsible, setGroupByResponsible] = useState(false);
  const [sortActionsBy, setSortActionsBy] = useState('name');

  useEffect(() => {
    fetch('/api/airtable')
      .then(res => res.json())
      .then(data => {
        setMilestones(data.milestones || []);
        setActions(data.actions || []);
        // Initialize all priorities as selected
        const allPriorities = new Set(
          (data.milestones || [])
            .map(m => m.fields.Priority?.[0])
            .filter(Boolean)
        );
        setSelectedPriorities(allPriorities);
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

  // Process milestones data for Gantt chart
  const chartData = milestones.map(milestone => {
    const name = milestone.fields.Name || 'Unnamed Activity';
    const deadline = milestone.fields.Deadline || '';
    const priority = milestone.fields.Priority?.[0] || 'No Priority';
    
    const deadlineDate = new Date(deadline);
    const startDate = new Date(deadlineDate);
    startDate.setMonth(startDate.getMonth() - 3);
    
    return {
      id: milestone.id,
      name,
      priority,
      start: startDate,
      end: deadlineDate,
      deadline
    };
  })
  .filter(item => item.deadline)
  .filter(item => selectedPriorities.has(item.priority));

  let sortedData = [...chartData];
  if (sortByDeadline) {
    sortedData.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  const priorities = [...new Set(milestones.map(m => m.fields.Priority?.[0]).filter(Boolean))].sort();

  const organizedData = groupByPriority
    ? priorities
        .filter(priority => selectedPriorities.has(priority))
        .map(priority => ({
          priority,
          items: sortedData.filter(item => item.priority === priority)
        }))
        .filter(group => group.items.length > 0)
    : [{ priority: null, items: sortedData }];

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

  const priorityColors = {
    '1. Governance and Leadership': '#3b82f6',
    '2. Grant making [national perspective approach for Year 1] ': '#10b981',
    '3. Infrastructure capability support and development': '#f59e0b',
    '4. Learning and Impact': '#ef4444'
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
  const processedActions = actions.map(action => ({
    id: action.id,
    name: action.fields.Name || 'Unnamed Action',
    responsible: action.fields.Responsible || 'Unassigned',
    deadline: action.fields.Deadline || '',
    status: action.fields.Status || 'No Status'
  })).filter(action => action.name !== 'Unnamed Action');

  // Sort actions
  let sortedActions = [...processedActions];
  if (sortActionsBy === 'name') {
    sortedActions.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortActionsBy === 'deadline') {
    sortedActions.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
  } else if (sortActionsBy === 'responsible') {
    sortedActions.sort((a, b) => a.responsible.localeCompare(b.responsible));
  } else if (sortActionsBy === 'status') {
    sortedActions.sort((a, b) => a.status.localeCompare(b.status));
  }

  // Group actions by responsible if enabled
  const organizedActions = groupByResponsible
    ? [...new Set(sortedActions.map(a => a.responsible))]
        .sort()
        .map(responsible => ({
          responsible,
          items: sortedActions.filter(a => a.responsible === responsible)
        }))
    : [{ responsible: null, items: sortedActions }];

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
                    Total Milestones {selectedPriorities.size < priorities.length ? '(Filtered)' : ''}
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
                    {chartData.length}
                  </div>
                </div>
                {priorities.filter(p => selectedPriorities.has(p)).map(priority => {
                  const count = chartData.filter(item => item.priority === priority).length;
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
                <strong>Note:</strong> Start dates are estimated as 3 months before each deadline for visualization purposes.
                Data synced from Airtable in real-time.
              </div>
            </>
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <>
              {/* Actions Controls */}
              <div style={{ 
                display: 'flex', 
                gap: '15px', 
                marginBottom: '20px',
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontWeight: '600', color: '#1e293b', marginRight: '10px' }}>
                  Sort by:
                </span>
                
                <select
                  value={sortActionsBy}
                  onChange={(e) => setSortActionsBy(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  <option value="name">Name</option>
                  <option value="deadline">Deadline</option>
                  <option value="responsible">Responsible</option>
                  <option value="status">Status</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginLeft: 'auto' }}>
                  <input 
                    type="checkbox" 
                    checked={groupByResponsible}
                    onChange={(e) => setGroupByResponsible(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#475569' }}>Group by Responsible</span>
                </label>
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
                    {groupByResponsible && (
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
                          {group.responsible} ({group.items.length} action{group.items.length !== 1 ? 's' : ''})
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
                          fontSize: '14px',
                          color: '#334155'
                        }}>
                          {action.status}
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
                  Total Actions
                </div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
                  {processedActions.length}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
