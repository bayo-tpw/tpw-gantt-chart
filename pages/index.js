import { useState, useEffect } from 'react';
import Head from 'next/head';

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
      <>
        <Head>
          <style>{`
            body { 
              margin: 0 !important; 
              padding: 0 !important; 
              width: 100vw !important;
              font-family: Arial, sans-serif !important;
            }
            #__next { 
              width: 100vw !important; 
              margin: 0 !important; 
              padding: 0 !important; 
            }
            * { 
              box-sizing: border-box !important; 
            }
          `}</style>
        </Head>
        <div style={{ 
          width: '100vw', 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#f8f9fa',
          margin: 0,
          padding: 0
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '40px', 
            borderRadius: '8px', 
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' 
          }}>
            <h2 style={{ fontSize: '24px', marginBottom: '10px', margin: '0 0 10px 0' }}>Loading...</h2>
            <p style={{ color: '#666', margin: 0 }}>Fetching data from Airtable</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <style>{`
          body { 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 100vw !important;
            font-family: Arial, sans-serif !important;
            background-color: #f8f9fa !important;
          }
          #__next { 
            width: 100vw !important; 
            margin: 0 !important; 
            padding: 0 !important; 
          }
          * { 
            box-sizing: border-box !important; 
          }
        `}</style>
      </Head>
      
      <div style={{
        width: '100vw',
        minHeight: '100vh',
        padding: '30px',
        backgroundColor: '#f8f9fa',
        margin: 0
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          marginBottom: '40px',
          color: '#333',
          textAlign: 'center',
          width: '100%'
        }}>
          TPW Regional Delivery Action Plan
        </h1>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '40px',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            backgroundColor: '#e9ecef',
            borderRadius: '12px',
            padding: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <button
              style={{
                padding: '14px 28px',
                border: 'none',
                background: activeTab === 'gantt' ? 'white' : 'transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'gantt' ? 'bold' : '500',
                borderRadius: '8px',
                color: activeTab === 'gantt' ? '#007bff' : '#666',
                boxShadow: activeTab === 'gantt' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
              }}
              onClick={() => setActiveTab('gantt')}
            >
              Gantt Chart ({processedChartData.length})
            </button>
            <button
              style={{
                padding: '14px 28px',
                border: 'none',
                background: activeTab === 'actions' ? 'white' : 'transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === 'actions' ? 'bold' : '500',
                borderRadius: '8px',
                color: activeTab === 'actions' ? '#007bff' : '#666',
                boxShadow: activeTab === 'actions' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
              }}
              onClick={() => setActiveTab('actions')}
            >
              Actions ({processedActions.length})
            </button>
          </div>
        </div>

        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%'
        }}>
          {activeTab === 'gantt' && (
            <div>
              <h2 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                marginBottom: '30px',
                color: '#333',
                borderBottom: '3px solid #007bff',
                paddingBottom: '12px',
                textAlign: 'center'
              }}>
                Milestones
              </h2>
              {processedChartData.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '80px 20px',
                  color: '#666',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                  <h3 style={{ fontSize: '24px', marginBottom: '12px', color: '#333' }}>No milestones found</h3>
                  <p style={{ fontSize: '16px' }}>Check your Airtable configuration</p>
                </div>
              ) : (
                processedChartData.map(item => (
                  <div key={item.id} style={{
                    backgroundColor: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 'bold',
                      marginBottom: '16px',
                      color: '#333',
                      lineHeight: '1.4'
                    }}>
                      {item.name}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px'
                    }}>
                      <div style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#333', marginRight: '8px', minWidth: '90px' }}>Priority:</span>
                        <span>{item.priority}</span>
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#333', marginRight: '8px', minWidth: '90px' }}>Status:</span>
                        <span style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          backgroundColor: item.status.toLowerCase().includes('complete') ? '#e8f5e8' : 
                                         item.status.toLowerCase().includes('progress') ? '#e3f2fd' : '#f8f9fa',
                          color: item.status.toLowerCase().includes('complete') ? '#2e7d32' : 
                                item.status.toLowerCase().includes('progress') ? '#1976d2' : '#6c757d'
                        }}>
                          {item.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#333', marginRight: '8px', minWidth: '90px' }}>Accountable:</span>
                        <span>{item.accountable}</span>
                      </div>
                      {item.deadline && (
                        <div style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: '#333', marginRight: '8px', minWidth: '90px' }}>Deadline:</span>
                          <span>{new Date(item.deadline).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div>
              <h2 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                marginBottom: '30px',
                color: '#333',
                borderBottom: '3px solid #007bff',
                paddingBottom: '12px',
                textAlign: 'center'
              }}>
                Actions (Director View Only)
              </h2>
              {processedActions.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '80px 20px',
                  color: '#666',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                  <h3 style={{ fontSize: '24px', marginBottom: '12px', color: '#333' }}>No actions found</h3>
                  <p style={{ fontSize: '16px' }}>No actions have Director View = true</p>
                </div>
              ) : (
                processedActions.map(action => (
                  <div key={action.id} style={{
                    backgroundColor: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '24px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 'bold',
                      marginBottom: '16px',
                      color: '#333',
                      lineHeight: '1.4'
                    }}>
                      {action.name}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px'
                    }}>
                      <div style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#333', marginRight: '8px', minWidth: '90px' }}>Responsible:</span>
                        <span>{action.responsible}</span>
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#333', marginRight: '8px', minWidth: '90px' }}>Status:</span>
                        <span style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          backgroundColor: action.status.toLowerCase().includes('complete') ? '#e8f5e8' : 
                                         action.status.toLowerCase().includes('progress') ? '#e3f2fd' : '#f8f9fa',
                          color: action.status.toLowerCase().includes('complete') ? '#2e7d32' : 
                                action.status.toLowerCase().includes('progress') ? '#1976d2' : '#6c757d'
                        }}>
                          {action.status}
                        </span>
                      </div>
                      {action.deadline && (
                        <div style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: '#333', marginRight: '8px', minWidth: '90px' }}>Deadline:</span>
                          <span>{new Date(action.deadline).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    {action.notes && (
                      <div style={{
                        marginTop: '20px',
                        borderTop: '1px solid #eee',
                        paddingTop: '16px'
                      }}>
                        <button
                          style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                          onClick={() => toggleNoteExpansion(action.id)}
                        >
                          {expandedNotes.has(action.id) ? 'Hide Notes' : 'Show Notes'}
                        </button>
                        {expandedNotes.has(action.id) && (
                          <div style={{
                            marginTop: '12px',
                            padding: '16px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            borderLeft: '4px solid #007bff',
                            color: '#555',
                            lineHeight: '1.6'
                          }}>
                            {action.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
