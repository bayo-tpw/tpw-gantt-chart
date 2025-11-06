export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('API: Starting data fetch...');
    
    if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_API_KEY) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }

    const Airtable = require('airtable');
    Airtable.configure({
      endpointUrl: 'https://api.airtable.com',
      apiKey: process.env.AIRTABLE_API_KEY
    });
    const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

    // Helper function to fetch all records with pagination
    async function fetchAllRecords(query) {
      try {
        let allRecords = [];
        
        await query.eachPage((records, fetchNextPage) => {
          allRecords = allRecords.concat(records);
          fetchNextPage();
        });
        
        return allRecords;
      } catch (error) {
        console.error('API: Error in fetchAllRecords:', error);
        throw error;
      }
    }

    console.log('API: Using direct field mappings');

    // Fetch Milestones with pagination
    console.log('API: Fetching Milestones...');
    const milestonesData = await fetchAllRecords(base('Milestones').select({
      fields: ['Name', 'Deadline', 'Priority', 'Status', 'Accountable', 'Start date']
    }));
    console.log('API: Milestones fetched:', milestonesData.length);

    // Fetch Actions with pagination
    console.log('API: Fetching Actions...');
    const actionsData = await fetchAllRecords(base('Actions').select({
      fields: ['Name', 'Responsible', 'Deadline', 'Status', 'Current Status (TPW Role)', 'Director View']
    }));
    console.log('API: Actions fetched:', actionsData.length);

    // Fetch People table with pagination
    console.log('API: Fetching People...');
    let peopleData = [];
    try {
      peopleData = await fetchAllRecords(base('People').select({
        fields: ['Name']
      }));
      console.log('API: People fetched:', peopleData.length);
    } catch (peopleError) {
      console.log('API: People table error, continuing without it');
    }

    // Process milestones
    const milestones = milestonesData.map(record => ({
      id: record.id,
      name: record.fields['Name'] || '',
      deadline: record.fields['Deadline'] || '',
      priority: Array.isArray(record.fields['Priority']) 
        ? record.fields['Priority'][0] 
        : record.fields['Priority'] || '',
      status: record.fields['Status'] || '',
      accountable: record.fields['Accountable'] || '',
      startDate: record.fields['Start date'] || ''
    }));

    // Create people map for linked records
    const peopleMap = {};
    peopleData.forEach(record => {
      peopleMap[record.id] = record.fields.Name || 'Unknown';
    });

    // Process actions with Director View filtering
    const actions = actionsData
      .filter(record => {
        // Filter by TPW Role = 'Current' AND Director View = true
        const tpwRole = record.fields['Current Status (TPW Role)'];
        const directorView = record.fields['Director View'];
        return tpwRole === 'Current' && directorView === true;
      })
      .map(record => {
        const responsibleField = record.fields['Responsible'];
        let responsible = 'Unassigned';

        // Handle both linked records and single select text
        if (Array.isArray(responsibleField) && responsibleField.length > 0) {
          // Linked record - look up name from peopleMap
          const responsibleId = responsibleField[0];
          responsible = peopleMap[responsibleId] || 'Unknown';
        } else if (typeof responsibleField === 'string') {
          // Single select text
          responsible = responsibleField;
        }

        return {
          id: record.id,
          name: record.fields['Name'] || '',
          responsible: responsible,
          deadline: record.fields['Deadline'] || '',
          status: record.fields['Status'] || '',
          tpwRole: record.fields['Current Status (TPW Role)'] || '',
          directorView: record.fields['Director View'] || false
        };
      });

    console.log('API: Processed', milestones.length, 'milestones and', actions.length, 'actions');

    const response = {
      milestones,
      actions,
      peopleMap,
      prioritiesMap: {},
      debug: {
        totalActionsBeforeFilter: actionsData.length,
        totalActionsAfterFilter: actions.length,
        directorViewFieldName: 'Director View'
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('API: Error fetching data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch data', 
      details: error.message
    });
  }
}
