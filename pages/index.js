import { useState, useEffect } from 'react';
import Head from 'next/head';

/**
 * ============================================================================
 * AIRTABLE DYNAMIC CONFIGURATION
 * ============================================================================
 * 
 * This Gantt chart uses DYNAMIC FIELD MAPPING from Airtable.
 * Field names are stored in a Config table in Airtable, so you can rename
 * fields without touching any code!
 * 
 * REQUIRED AIRTABLE STRUCTURE:
 * 
 * TABLE: Config
 * ----------------
 * This table tells the app which field names to use.
 * Required Records (Key | Value format):
 *   - milestone_name_field | Name (or your field name)
 *   - milestone_deadline_field | Deadline (or your field name)
 *   - milestone_priority_id_field | Priority area (or your field name)
 *   - milestone_priority_name_field | Priority (or your field name)
 *   - milestone_activities_field | Activities (or your field name)
 * 
 * To rename a field:
 * 1. Rename the field in your Milestones table
 * 2. Update the corresponding Value in the Config table
 * 3. Done! No code changes needed.
 * 
 * TABLE: Milestones
 * ----------------
 * Your main milestones/deliverables table.
 * Field names are defined in the Config table above.
 * 
 * TABLE: Priority Areas
 * --------------------
 * Contains your 4 priority areas. Colors are mapped by Record ID (stable).
 * DO NOT delete these records or the color mapping will break:
 *   - rec2WWPaWQHiJuvOo = 1. Governance and Leadership (Blue #3b82f6)
 *   - recBiU2a1gpJCH3jn = 2. Grant making (Green #10b981)
 *   - recIKmZArvGuwMxBS = 3. Capability support and development (Orange #f59e0b)
 *   - recw7DlH172o0BrlT = 4. Learning and Impact (Red #ef4444)
 * 
 * You can rename these priorities freely - colors are linked to IDs.
 */

// PRIORITY COLOR MAPPING - Uses stable record IDs (safe from renames)
const PRIORITY_COLORS = {
  'rec2WWPaWQHiJuvOo': '#3b82f6', // 1. Governance and Leadership (blue)
  'recBiU2a1gpJCH3jn': '#10b981', // 2. Grant making (green)
  'recIKmZArvGuwMxBS': '#f59e0b', // 3. Capability support and development (orange)
  'recw7DlH172o0BrlT': '#ef4444'  // 4. Learning and Impact (red)
};

/**
 * ============================================================================
 * END CONFIGURATION
 * ============================================================================
 */

export default function Home() {
  const [milestones, setMilestones] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupByPriority, setGroupByPriority] = useState(true);
  const [sortByDeadline, setSortByDeadline] = useState(false);
  const [selectedPriorities, setSelectedPriorities] = useState(new Set());

  useEffect(() => {
    fetch('/api/airtable')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          throw new Error(data.message || data.error);
        }
        
        setConfig(data.config);
        setMilestones(data.milestones || []);
        
        // Initialize all priorities as selected using IDs
        const priorityIdField = data.config.milestone_priority_id_field;
        const allPriorityIds = new Set(
          (data.milestones || [])
            .map(m => m.fields[priorityIdField]?.[0])
            .filter(Boolean)
        );
        setSelectedPriorities(allPriorityIds);
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
        <p>Loading Gantt chart...</p>
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

  if (!config) {
    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui' }}>
        <h1>TPW Regional Delivery Action Plan</h1>
        <p style={{ color: 'orange' }}>Configuration not loaded. Please ensure Config table exists in Airtable.</p>
      </div>
    );
  }

  // Process data for Gantt chart using dynamic field names from config
  const chartData = milestones.map(milestone => {
    const name = milestone.fields[config.milestone_name_field] || 'Unnamed Activity';
    const deadline = milestone.fields[config.milestone_deadline_field] || '';
    const priorityId = milestone.fields[config.milestone_priority_id_field]?.[0] || 'No Priority';
    const priorityName = milestone.fields[config.milestone_priority_name_field]?.[0] || 'No Priority';
    
    // Parse deadline (format: YYYY-MM-DD)
    const deadlineDate = new Date(deadline);
    
    // Estimate start date (3 months before deadline for visualization)
    const startDate = new Date(deadlineDate);
    startDate.setMonth(startDate.getMonth() - 3);
    
    return {
      id: milestone.id,
      name,
      priorityId,
      priorityName,
      start: startDate,
      end: deadlineDate,
      deadline
    };
  })
  .filter(item => item.deadline) // Only show items with deadlines
  .filter(item => selectedPriorities.has(item.priorityId)); // Only show selected priorities

  // Sort by deadline if enabled
  let sortedData = [...chartData];
  if (sortByDeadline) {
    sortedData.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  // Create mapping of priority IDs to names using dynamic config
  const priorityIdToName = {};
  milestones.forEach(m => {
    const id = m.fields[config.milestone_priority_id_field]?.[0];
    const name = m.fields[config.milestone_priority_name_field]?.[0];
    if (id && name) {
      priorityIdToName[id] = name;
    }
  });

  // Get all unique priority IDs and their names
  const priorityIds = [...new Set(milestones.map(m => m.fields[config.milestone_priority_id_field]?.[0]).filter(Boolean))];
  const priorities = priorityIds.map(id => ({
    id,
    name: priorityIdToName[id]
  })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Use the PRIORITY_COLORS constant defined at the top

  // Organize data by priority if grouping is enabled
  const organizedData = groupByPriority
    ? priorities
        .filter(p => selectedPriorities.has(p.id)) // Only include selected priorities
        .map(p => ({
          priorityId: p.id,
          priorityName: p.name,
          items: sortedData.filter(item => item.priorityId === p.id)
        }))
        .filter(group => group.items.length > 0)
    : [{ priorityId: null, priorityName: null, items: sortedData }];

  const togglePriority = (priorityId) => {
    const newSelected = new Set(selectedPriorities);
    if (newSelected.has(priorityId)) {
      newSelected.delete(priorityId);
    } else {
      newSelected.add(priorityId);
    }
    setSelectedPriorities(newSelected);
  };

  const selectAllPriorities = () => {
    setSelectedPriorities(new Set(priorities.map(p => p.id)));
  };

  const deselectAllPriorities = () => {
    setSelectedPriorities(new Set());
  };

  // Calculate timeline bounds
  const allDates = chartData.flatMap(item => [item.start, item.end]);
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  
  // Round to month boundaries
  minDate.setDate(1);
  maxDate.setMonth(maxDate.getMonth() + 1);
  maxDate.setDate(0);

  // Generate month markers
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

  return (
    <>
      <Head>
        <title>TPW Regional Delivery Action Plan - Gantt Chart</title>
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

          {/* Priority Filter (Interactive Legend) */}
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
                const isSelected = selectedPriorities.has(priority.id);
                return (
                  <label 
                    key={priority.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isSelected ? PRIORITY_COLORS[priority.id] || '#94a3b8' : '#e2e8f0',
                      backgroundColor: isSelected ? `${PRIORITY_COLORS[priority.id] || '#94a3b8'}10` : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePriority(priority.id)}
                      style={{ 
                        width: '16px', 
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: PRIORITY_COLORS[priority.id] || '#94a3b8'
                      }}
                    />
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: PRIORITY_COLORS[priority.id] || '#94a3b8',
                      borderRadius: '2px',
                      opacity: isSelected ? 1 : 0.3
                    }} />
                    <span style={{ 
                      fontSize: '14px', 
                      color: isSelected ? '#1e293b' : '#94a3b8',
                      fontWeight: isSelected ? '500' : '400'
                    }}>
                      {priority.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Filter Controls */}
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
                {/* Priority Header (only show if grouping is enabled) */}
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
                      {group.priorityName}
                    </div>
                    <div style={{ flex: 1, paddingLeft: '16px', color: '#64748b' }}>
                      {group.items.length} milestone{group.items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
                
                {/* Items in this group */}
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
                          {item.priorityName}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, position: 'relative', padding: '8px 0' }}>
                      {/* Timeline grid */}
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
                      
                      {/* Bar */}
                      <div style={{
                        position: 'absolute',
                        left: `${getPosition(item.start)}%`,
                        width: `${getPosition(item.end) - getPosition(item.start)}%`,
                        height: '32px',
                        backgroundColor: PRIORITY_COLORS[item.priorityId] || '#94a3b8',
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
            {priorities.filter(p => selectedPriorities.has(p.id)).map(priority => {
              const count = chartData.filter(item => item.priorityId === priority.id).length;
              return (
                <div key={priority.id} style={{ 
                  padding: '20px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
                    {priority.name}
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: PRIORITY_COLORS[priority.id] }}>
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
        </div>
      </div>
    </>
  );
}
