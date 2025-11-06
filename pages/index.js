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
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  const containerStyle = {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f8f9fa'
  };

  const headerStyle = {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#333'
  };

  const tabContainerStyle = {
    display: 'flex',
    marginBottom: '20px',
    borderBottom: '2px solid #ddd'
  };

  const tabStyle = {
    padding: '10px 20px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '16px',
    borderBottom: '2px solid transparent'
  };

  const activeTabStyle = {
    ...tabStyle,
    borderBottom: '2px solid #007bff',
    color: '#007bff',
    fontWeight: 'bold'
  };

  const cardStyle = {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '15px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const cardTitleStyle = {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#333'
  };

  const cardDetailStyle = {
    fontSize: '14px',
    color: '#666',
    marginBottom: '4px'
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>TPW Regional Delivery Action Plan</h1>
      
      {/* Tabs */}
      <div style={tabContainerStyle}>
        <button
          style={activeTab === 'gantt' ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab('gantt')}
        >
          Gantt Chart ({processedChartData.length})
        </button>
        <button
          style={activeTab === 'actions' ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab('actions')}
        >
          Actions ({processedActions.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'gantt' && (
        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>Milestones</h2>
          {processedChartData.length === 0 ? (
            <p>No milestones found.</p>
          ) : (
            processedChartData.map(item => (
              <div key={item.id} style={cardStyle}>
                <div style={cardTitleStyle}>{item.name}</div>
                <div style={cardDetailStyle}>Priority: {item.priority}</div>
                <div style={cardDetailStyle}>Status: {item.status}</div>
                <div style={cardDetailStyle}>Accountable: {item.accountable}</div>
                {item.deadline && (
                  <div style={cardDetailStyle}>
                    Deadline: {new Date(item.deadline).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'actions' && (
        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>
            Actions (Director View Only)
          </h2>
          {processedActions.length === 0 ? (
            <p>No actions found with Director View = true.</p>
          ) : (
            processedActions.map(action => (
              <div key={action.id} style={cardStyle}>
                <div style={cardTitleStyle}>{action.name}</div>
                <div style={cardDetailStyle}>Responsible: {action.responsible}</div>
                <div style={cardDetailStyle}>Status: {action.status}</div>
                {action.deadline && (
                  <div style={cardDetailStyle}>
                    Deadline: {new Date(action.deadline).toLocaleDateString()}
                  </div>
                )}
                {action.notes && (
                  <div style={{ ...cardDetailStyle, marginTop: '8px', fontStyle: 'italic' }}>
                    Notes: {action.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
