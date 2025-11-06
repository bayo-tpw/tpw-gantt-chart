import { useState, useEffect } from 'react';

export default function GanttChart() {
  const [data, setData] = useState({
    milestones: [],
    actions: [],
    peopleMap: {},
    prioritiesMap: {},
    config: {}
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('gantt');
  const [expandedNotes, setExpandedNotes] = useState(new Set());

  const { milestones, actions, peopleMap, prioritiesMap, config } = data;

  useEffect(() => {
    // Add CSS directly to the document head to override any conflicts
    const style = document.createElement('style');
    style.textContent = `
      body, html {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        box-sizing: border-box !important;
        font-family: Arial, sans-serif !important;
        background: #f5f5f5 !important;
      }
      #__next {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .app-container {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 20px !important;
        box-sizing: border-box !important;
      }
      .content-wrapper {
        max-width: 1200px !important;
        margin: 0 auto !important;
        width: 100% !important;
      }
    `;
    document.head.appendChild(style);

    fetch('/api/airtable')
      .then(response => response.json())
      .then(data => {
        console.log('Data loaded successfully');
        setData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setLoading(false);
      });

    return () => {
      // Cleanup
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);

  const toggleNoteExpansion = (actionId) => {
    const newSet = new Set(expandedNotes);
    if (newSet.has(actionId)) {
      newSet.delete(actionId);
    } else {
      newSet.add(actionId);
    }
    setExpandedNotes(newSet);
  };

  // Process milestones
  const processedChartData = milestones.map(milestone => {
    const priorityName = milestone.fields?.[config?.milestone_priority_name_field || 'Priority'];
    let priority = 'Unknown';
    if (priorityName) {
      priority = Array.isArray(priorityName) ? priorityName[0] : priorityName;
    }

    const accountableField = milestone.fields?.[config?.milestone_accountable_field || 'Accountable'];
    let accountable = 'Unknown';
    if (Array.isArray(accountableField) && accountableField.length > 0) {
      accountable = peopleMap[accountableField[0]] || 'Unknown';
    } else if (typeof accountableField === 'string') {
      accountable = accountableField;
    }

    return {
      id: milestone.id,
      name: milestone.fields?.[config?.milestone_name_field || 'Name'] || 'Untitled',
      priority,
      accountable,
      status: milestone.fields?.[config?.milestone_status_field || 'Status'] || 'Unknown',
      deadline: milestone.fields?.[config?.milestone_deadline_field || 'Deadline']
    };
  });

  // Process actions
  const processedActions = actions
    .filter(action => {
      const tpwRole = action.fields?.[config?.action_tpw_role_field || 'Current Status (TPW Role)'];
      const directorView = action.fields?.[config?.action_director_view_field || 'Director View'];
      return tpwRole === 'Current' && (directorView === true || directorView === 'true' || directorView === 1);
    })
    .map(action => {
      const responsibleField = action.fields?.[config?.action_responsible_field || 'Responsible'];
      let responsible = 'Unknown';
      if (Array.isArray(responsibleField) && responsibleField.length > 0) {
        responsible = peopleMap[responsibleField[0]] || 'Unknown';
      } else if (typeof responsibleField === 'string') {
        responsible = responsibleField;
      }

      return {
        id: action.id,
        name: action.fields?.[config?.action_name_field || 'Name'] || 'Untitled',
        responsible,
        deadline: action.fields?.[config?.action_deadline_field || 'Deadline'] || '',
        status: action.fields?.[config?.action_status_field || 'Status'] || 'Unknown',
        notes: action.fields?.[config?.action_notes_field || 'Notes'] || ''
      };
    });

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        background: '#f5f5f5'
      }}>
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Loading...</h2>
          <p style={{ margin: 0, color: '#666' }}>Fetching data from Airtable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <h1 style={{
          textAlign: 'center',
          fontSize: '36px',
          margin: '0 0 40px 0',
          color: '#333',
          fontWeight: 'bold'
        }}>
          TPW Regional Delivery Action Plan
        </h1>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '40px'
        }}>
          <div style={{
            display: 'flex',
            background: '#e9ecef',
            borderRadius: '10px',
            padding: '5px'
          }}>
            <button
              onClick={() => setActiveTab('gantt')}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === 'gantt' ? 'white' : 'transparent',
                color: activeTab === 'gantt' ? '#007bff' : '#666',
                fontWeight: activeTab === 'gantt' ? 'bold' : 'normal',
                fontSize: '16px',
                cursor: 'pointer',
                boxShadow: activeTab === 'gantt' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Milestones ({processedChartData.length})
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === 'actions' ? 'white' : 'transparent',
                color: activeTab === 'actions' ? '#007bff' : '#666',
                fontWeight: activeTab === 'actions' ? 'bold' : 'normal',
                fontSize: '16px',
                cursor: 'pointer',
                boxShadow: activeTab === 'actions' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Actions ({processedActions.length})
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'gantt' && (
          <div>
            <h2 style={{
              fontSize: '28px',
              textAlign: 'center',
              margin: '0 0 30px 0',
              color: '#333',
              borderBottom: '3px solid #007bff',
              paddingBottom: '10px'
            }}>
              Milestones
            </h2>

            {processedChartData.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px',
                background: 'white',
                borderRadius: '10px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ color: '#333', margin: '0 0 10px 0' }}>No milestones found</h3>
                <p style={{ color: '#666', margin: 0 }}>Check your Airtable configuration</p>
              </div>
            ) : (
              <div>
                {processedChartData.map(item => (
                  <div key={item.id} style={{
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '10px',
                    padding: '20px',
                    marginBottom: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      margin: '0 0 15px 0',
                      color: '#333',
                      fontWeight: 'bold'
                    }}>
                      {item.name}
                    </h3>
                    
                    <table style={{ width: '100%', fontSize: '14px' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '5px', fontWeight: 'bold', color: '#666', width: '120px' }}>Priority:</td>
                          <td style={{ padding: '5px', color: '#333' }}>{item.priority}</td>
                          <td style={{ padding: '5px', fontWeight: 'bold', color: '#666', width: '120px' }}>Status:</td>
                          <td style={{ padding: '5px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              background: item.status.toLowerCase().includes('complete') ? '#d4edda' : 
                                         item.status.toLowerCase().includes('progress') ? '#cce5ff' : '#f8f9fa',
                              color: item.status.toLowerCase().includes('complete') ? '#155724' : 
                                    item.status.toLowerCase().includes('progress') ? '#0056b3' : '#6c757d'
                            }}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '5px', fontWeight: 'bold', color: '#666' }}>Accountable:</td>
                          <td style={{ padding: '5px', color: '#333' }}>{item.accountable}</td>
                          <td style={{ padding: '5px', fontWeight: 'bold', color: '#666' }}>Deadline:</td>
                          <td style={{ padding: '5px', color: '#333' }}>
                            {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'Not set'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div>
            <h2 style={{
              fontSize: '28px',
              textAlign: 'center',
              margin: '0 0 30px 0',
              color: '#333',
              borderBottom: '3px solid #007bff',
              paddingBottom: '10px'
            }}>
              Actions (Director View Only)
            </h2>

            {processedActions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px',
                background: 'white',
                borderRadius: '10px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ color: '#333', margin: '0 0 10px 0' }}>No actions found</h3>
                <p style={{ color: '#666', margin: 0 }}>No actions have Director View = true</p>
              </div>
            ) : (
              <div>
                {processedActions.map(action => (
                  <div key={action.id} style={{
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '10px',
                    padding: '20px',
                    marginBottom: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      margin: '0 0 15px 0',
                      color: '#333',
                      fontWeight: 'bold'
                    }}>
                      {action.name}
                    </h3>
                    
                    <table style={{ width: '100%', fontSize: '14px' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '5px', fontWeight: 'bold', color: '#666', width: '120px' }}>Responsible:</td>
                          <td style={{ padding: '5px', color: '#333' }}>{action.responsible}</td>
                          <td style={{ padding: '5px', fontWeight: 'bold', color: '#666', width: '120px' }}>Status:</td>
                          <td style={{ padding: '5px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              background: action.status.toLowerCase().includes('complete') ? '#d4edda' : 
                                         action.status.toLowerCase().includes('progress') ? '#cce5ff' : '#f8f9fa',
                              color: action.status.toLowerCase().includes('complete') ? '#155724' : 
                                    action.status.toLowerCase().includes('progress') ? '#0056b3' : '#6c757d'
                            }}>
                              {action.status}
                            </span>
                          </td>
                        </tr>
                        {action.deadline && (
                          <tr>
                            <td style={{ padding: '5px', fontWeight: 'bold', color: '#666' }}>Deadline:</td>
                            <td style={{ padding: '5px', color: '#333' }} colSpan={3}>
                              {new Date(action.deadline).toLocaleDateString()}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {action.notes && (
                      <div style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                        <button
                          onClick={() => toggleNoteExpansion(action.id)}
                          style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          {expandedNotes.has(action.id) ? 'Hide Notes' : 'Show Notes'}
                        </button>
                        {expandedNotes.has(action.id) && (
                          <div style={{
                            marginTop: '10px',
                            padding: '15px',
                            background: '#f8f9fa',
                            borderRadius: '6px',
                            borderLeft: '4px solid #007bff',
                            color: '#555'
                          }}>
                            {action.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
