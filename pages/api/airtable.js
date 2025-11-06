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

    // Function to fetch all records with pagination
    async function fetchAllRecords(tableName) {
      let allRecords = [];
      let offset = null;
      
      do {
        const url = offset 
          ? `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableName)}?offset=${offset}`
          : `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableName)}`;
        
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
        });
        const data = await response.json();
        
        allRecords = allRecords.concat(data.records || []);
        offset = data.offset;
      } while (offset);
      
      return allRecords;
    }

    // Fetch Milestones, Actions, People, and Priorities using config
    const peopleTableName = config.people_table_name || 'People';
    console.log('API: About to fetch from People table:', peopleTableName);
    
    const [milestonesRecords, actionsRecords, peopleRecords, prioritiesRecords] = await Promise.all([
      fetchAllRecords('Milestones'),
      fetchAllRecords('Actions'),
      fetchAllRecords(peopleTableName),
      fetchAllRecords('Priorities')
    ]);

    console.log('API: People table fetched:', peopleRecords.length, 'total records (with pagination)');

    // Create maps
    const peopleMap = {};
    peopleRecords.forEach(person => {
      peopleMap[person.id] = person.fields.Name || 'Unknown';
    });
    
    console.log('API: Fetching from table:', peopleTableName);
    console.log('API: Sample person:', peopleRecords[0]);
    console.log('API: First 3 people IDs:', Object.keys(peopleMap).slice(0, 3));
    console.log('API: First 3 people names:', Object.values(peopleMap).slice(0, 3));
    console.log('API: peopleMap has', Object.keys(peopleMap).length, 'entries');
    console.log('API: Looking for Adebayo (recrPq94c7VibDBk8):', peopleMap['recrPq94c7VibDBk8']);

    const prioritiesMap = {};
    prioritiesRecords.forEach(priority => {
      prioritiesMap[priority.id] = priority.fields.Name || 'Unknown';
    });

    const processedData = {
      config,
      milestones: milestonesRecords,
      actions: actionsRecords,
      peopleMap,
      prioritiesMap
    };

    res.status(200).json(processedData);
  } catch (error) {
    console.error('Airtable API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
