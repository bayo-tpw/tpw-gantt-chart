export default async function handler(req, res) {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appbk0K9riLmqNa56';
  
  if (!AIRTABLE_TOKEN) {
    return res.status(500).json({ error: 'Airtable token not configured' });
  }

  try {
    // Fetch both Milestones and Actions
    const [milestonesData, actionsData] = await Promise.all([
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Milestones`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json()),
      
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Actions`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json())
    ]);

    const processedData = {
      milestones: milestonesData.records || [],
      actions: actionsData.records || []
    };

    res.status(200).json(processedData);
  } catch (error) {
    console.error('Airtable API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
