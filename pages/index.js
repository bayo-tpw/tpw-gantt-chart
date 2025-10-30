import { useState, useEffect } from 'react';

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/airtable')
      .then(res => res.json())
      .then(data => {
        console.log('Raw API response:', data);
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  // Extract milestones from your data structure
  const milestones = data?.milestones || [];

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>TPW Regional Action Plan - Milestones</h1>
      
      <div style={{ backgroundColor: '#f0f0f0', padding: '15px', marginBottom: '20px' }}>
        <h2>Summary:</h2>
        <p><strong>Total Milestones:</strong> {milestones.length}</p>
      </div>

      {milestones.length > 0 ? (
        <div>
          <h2>Your Milestones:</h2>
          
          {/* Simple list view first */}
          <div style={{ marginBottom: '30px' }}>
            {milestones.map((milestone, index) => {
              const fields = milestone.fields || {};
              return (
                <div key={milestone.id || index} style={{ 
                  border: '1px solid #ddd', 
                  margin: '10px 0', 
                  padding: '15px',
                  backgroundColor: '#fff',
                  borderRadius: '5px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
                    {fields.Name || 'Unnamed Milestone'}
                  </h3>
                  
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    <p><strong>Stage:</strong> {fields.Stage || 'Not specified'}</p>
                    {fields['Priority (from Projects)'] && (
                      <p><strong>Priority:</strong> {fields['Priority (from Projects)'][0] || 'Not specified'}</p>
                    )}
                    {fields.Allowance && (
                      <p><strong>Allowance:</strong> {fields.Allowance.specialValue || 'Not specified'}</p>
                    )}
                  </div>
                  
                  <details style={{ marginTop: '10px' }}>
                    <summary style={{ cursor: 'pointer', color: 'blue', fontSize: '12px' }}>
                      View raw data
                    </summary>
                    <pre style={{ 
                      backgroundColor: '#f5f5f5', 
                      padding: '8px', 
                      fontSize: '11px',
                      overflow: 'auto',
                      marginTop: '5px'
                    }}>
                      {JSON.stringify(fields, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>

          {/* Basic timeline view */}
          <h2>Timeline View:</h2>
          <div style={{ 
            border: '1px solid #ccc', 
            padding: '20px', 
            backgroundColor: '#f9f9f9',
            borderRadius: '5px'
          }}>
            <p style={{ fontStyle: 'italic', marginBottom: '15px' }}>
              Note: To create a proper Gantt chart, we need date fields in your Airtable. 
              Currently showing milestones by stage.
            </p>
            
            {['Planning', 'In Progress', 'Evidencing', 'Complete'].map(stage => {
              const stageItems = milestones.filter(m => m.fields.Stage === stage);
              return stageItems.length > 0 ? (
                <div key={stage} style={{ marginBottom: '15px' }}>
                  <h4 style={{ 
                    backgroundColor: '#e0e0e0', 
                    padding: '8px', 
                    margin: '0 0 8px 0',
                    borderRadius: '3px'
                  }}>
                    {stage} ({stageItems.length})
                  </h4>
                  <ul style={{ margin: '0', paddingLeft: '20px' }}>
                    {stageItems.map(item => (
                      <li key={item.id} style={{ marginBottom: '5px' }}>
                        {item.fields.Name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })}
          </div>
        </div>
      ) : (
        <div style={{ color: 'orange' }}>
          <h2>No milestones found!</h2>
          <p>The API connected successfully but returned no milestone data.</p>
        </div>
      )}
    </div>
  );
}
