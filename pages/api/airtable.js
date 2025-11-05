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
    const [milestonesData, actionsData, peopleData, prioritiesData] = await Promise.all([
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Milestones`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json()),
      
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Actions`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json()),
      
      fetch(`https://api.airtable.com/v0/${BASE_ID}/People`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json()),
      
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Priorities`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json())
    ]);

    // Create maps
    const peopleMap = {};
    (peopleData.records || []).forEach(person => {
      peopleMap[person.id] = person.fields.Name || 'Unknown';
    });

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
