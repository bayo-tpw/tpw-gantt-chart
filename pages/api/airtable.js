export default async function handler(req, res) {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appbk0K9riLmqNa56';
  
  if (!AIRTABLE_TOKEN) {
    return res.status(500).json({ error: 'Airtable token not configured' });
  }

  try {
    // First, fetch the Config table to get field mappings
    const configData = await fetch(`https://api.airtable.com/v0/${BASE_ID}/Config`, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    }).then(r => r.json());

    // Create config map from Key-Value pairs
    const config = {};
    (configData.records || []).forEach(record => {
      const key = record.fields.Key;
      const value = record.fields.Value;
      if (key && value) {
        config[key] = value;
      }
    });

    // Fetch Milestones, Actions, People, and Priorities using config
    const peopleTableName = config.people_table_name || 'People';
    console.log('API: About to fetch from People table:', peopleTableName);
    
    const [milestonesData, actionsData, peopleData, prioritiesData] = await Promise.all([
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Milestones`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json()),
      
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Actions`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json()),
      
      fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(peopleTableName)}`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => {
        console.log('API: People table response status:', r.status);
        return r.json();
      }),
      
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Priorities`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json())
    ]);

    console.log('API: People table response:', {
      hasRecords: !!peopleData.records,
      recordCount: peopleData.records?.length || 0,
      hasError: !!peopleData.error,
      error: peopleData.error
    });

    // Create maps
    const peopleMap = {};
    (peopleData.records || []).forEach(person => {
      peopleMap[person.id] = person.fields.Name || 'Unknown';
    });
    
    console.log('API: Fetching from table:', peopleTableName);
    console.log('API: People table fetched:', peopleData.records?.length || 0, 'records');
    console.log('API: Sample person:', peopleData.records?.[0]);
    console.log('API: First 3 people IDs:', Object.keys(peopleMap).slice(0, 3));
    console.log('API: First 3 people names:', Object.values(peopleMap).slice(0, 3));
    console.log('API: peopleMap has', Object.keys(peopleMap).length, 'entries');
    console.log('API: Looking for Adebayo (recrPq94c7VibDBk8):', peopleMap['recrPq94c7VibDBk8']);
    console.log('API: All people IDs:', Object.keys(peopleMap));

    const prioritiesMap = {};
    (prioritiesData.records || []).forEach(priority => {
      prioritiesMap[priority.id] = priority.fields.Name || 'Unknown';
    });

    const processedData = {
      config,
      milestones: milestonesData.records || [],
      actions: actionsData.records || [],
      peopleMap,
      prioritiesMap
    };

    res.status(200).json(processedData);
  } catch (error) {
    console.error('Airtable API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
