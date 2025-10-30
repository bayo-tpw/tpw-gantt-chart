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

  // Handle both array and object responses
  let records = [];
  if (data) {
    if (Array.isArray(data)) {
      records = data;
    } else if (data.records && Array.isArray(data.records)) {
      records = data.records;
    } else if (typeof data === 'object') {
      // If it's an object, convert it to an array
      records = [data];
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>TPW Gantt Chart - Debug Mode</h1>
      
      <div style={{ backgroundColor: '#f0f0f0', padding: '15px', marginBottom: '20px' }}>
        <h2>Debug Information:</h2>
        <p><strong>Data type:</strong> {typeof data}</p>
        <p><strong>Is Array:</strong> {Array.isArray(data) ? 'Yes' : 'No'}</p>
        <p><strong>Records found:</strong> {records.length}</p>
        
        <details>
          <summary style={{ cursor: 'pointer', color: 'blue' }}>
            Click to see raw API response
          </summary>
          <pre style={{ 
            backgroundColor: 'white', 
            padding: '10px', 
            border: '1px solid #ccc',
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>

      {records.length > 0 ? (
        <div>
          <h2>Your Airtable Records:</h2>
          {records.slice(0, 5).map((record, index) => (
            <div key={index} style={{ 
              border: '1px solid #ccc', 
              margin: '10px 0', 
              padding: '15px',
              backgroundColor: '#f9f9f9'
            }}>
              <h3>Record {index + 1}:</h3>
              <p><strong>ID:</strong> {record.id || 'No ID'}</p>
              
              {record.fields && (
                <div>
                  <strong>Fields:</strong>
                  <pre style={{ 
                    backgroundColor: 'white', 
                    padding: '10px', 
                    marginTop: '5px',
                    fontSize: '12px'
                  }}>
                    {JSON.stringify(record.fields, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
          
          {records.length > 5 && (
            <p style={{ fontStyle: 'italic' }}>
              ... and {records.length - 5} more records
            </p>
          )}
        </div>
      ) : (
        <div style={{ color: 'orange' }}>
          <h2>No records found!</h2>
          <p>The API returned data, but we couldn't find any records in the expected format.</p>
        </div>
      )}
    </div>
  );
}
