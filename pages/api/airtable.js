export default async function handler(req, res) {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = 'appbk0K9riLmqNa56';
  
  if (!AIRTABLE_TOKEN) {
    return res.status(500).json({ error: 'Airtable token not configured' });
  }

  try {
    // Fetch Milestones
    const milestonesResponse = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/Milestones`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        },
      }
    );
    
    const milestonesData = await milestonesResponse.json();
    
    // Fetch Actions
    const actionsResponse = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/Actions`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        },
      }
    );
    
    const actionsData = await actionsResponse.json();
    
    // Fetch Projects
    const projectsResponse = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/Projects`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        },
      }
    );
    
    const projectsData = await projectsResponse.json();

    res.status(200).json({
      milestones: milestonesData.records,
      actions: actionsData.records,
      projects: projectsData.records,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
