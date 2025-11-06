export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('API: Starting table access test...');
    
    if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_API_KEY) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }

    const Airtable = require('airtable');
    Airtable.configure({
      endpointUrl: 'https://api.airtable.com',
      apiKey: process.env.AIRTABLE_API_KEY
    });
    const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

    // Test each table with minimal access
    let results = {};

    // Test Milestones
    try {
      console.log('API: Testing Milestones...');
      const milestones = await base('Milestones').select({ maxRecords: 1 }).firstPage();
      results.milestones = { success: true, count: milestones.length };
      console.log('API: Milestones OK');
    } catch (error) {
      results.milestones = { success: false, error: error.message };
      console.error('API: Milestones FAILED:', error.message);
    }

    // Test Actions
    try {
      console.log('API: Testing Actions...');
      const actions = await base('Actions').select({ maxRecords: 1 }).firstPage();
      results.actions = { success: true, count: actions.length };
      console.log('API: Actions OK');
    } catch (error) {
      results.actions = { success: false, error: error.message };
      console.error('API: Actions FAILED:', error.message);
    }

    // Return results
    res.status(200).json({
      test: 'Table access test',
      results: results,
      message: 'Check which tables are accessible'
    });

  } catch (error) {
    console.error('API: Error:', error);
    res.status(500).json({ error: error.message });
  }
}
