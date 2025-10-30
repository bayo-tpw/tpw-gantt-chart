export default async function handler(req, res) {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appbk0K9riLmqNa56';
  
  if (!AIRTABLE_TOKEN) {
    return res.status(500).json({ error: 'Airtable token not configured' });
  }

  try {
    // Try to fetch Priorities table - if it fails, we'll handle it
    let prioritiesData = { records: [] };
    try {
      const prioritiesResponse = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/Priorities`,
        { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
      );
      if (prioritiesResponse.ok) {
        prioritiesData = await prioritiesResponse.json();
      }
    } catch (e) {
      console.log('Priorities table not found or error:', e);
    }

    // Fetch main data
    const [milestonesData, actionsData, projectsData] = await Promise.all([
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Milestones`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json()),
      
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Actions`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json()),
      
      fetch(`https://api.airtable.com/v0/${BASE_ID}/Projects`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      }).then(r => r.json())
    ]);

    const processedData = {
      milestones: milestonesData.records || [],
      actions: actionsData.records || [],
      projects: projectsData.records || [],
      priorities: prioritiesData.records || []
    };

    res.status(200).json(processedData);
  } catch (error) {
    console.error('Airtable API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
