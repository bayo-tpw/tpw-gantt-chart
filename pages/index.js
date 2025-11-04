import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/airtable')
      .then(res => res.json())
      .then(data => {
        setMilestones(data.milestones || []);
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

  // Process data for Gantt chart
  const chartData = milestones.map(milestone => {
    const name = milestone.fields.Name || 'Unnamed Activity';
    const deadline = milestone.fields.Deadline || '';
    const priority = milestone.fields.Priority?.[0] || 'No Priority';
    
    // Parse deadline (format: YYYY-MM-DD)
    const deadlineDate = new Date(deadline);
    
    // Estimate start date (3 months before deadline for visualization)
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
  }).filter(item => item.deadline); // Only show items with deadlines

  // Group by priority
  const priorities = [...new Set(chartData.map(item => item.priority))].sort();

  // Color mapping for priorities
  const priorityColors = {
    '1. Governance and Leadership': '#3b82f6',
    '2. Grant making [national perspective approach for Year 1] ': '#10b981',
    '3. Infrastructure capability support and development': '#f59e0b',
    '4. Learning and Impact': '#ef4444'
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

          {/* Legend */}
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            {priorities.map(priority => (
              <div key={priority} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  backgroundColor: priorityColors[priority] || '#94a3b8',
                  borderRadius: '3px'
                }} />
                <span style={{ fontSize: '14px', color: '#475569' }}>{priority}</span>
              </div>
            ))}
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
            {chartData.map((item, idx) => (
              <div 
                key={item.id}
                style={{ 
                  display: 'flex',
                  borderBottom: idx < chartData.length - 1 ? '1px solid #e2e8f0' : 'none',
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
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {item.priority}
                  </div>
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
                Total Milestones
              </div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
                {chartData.length}
              </div>
            </div>
            {priorities.map(priority => {
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
        </div>
      </div>
    </>
  );
}
