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

    // Use hard-coded field mappings (based on your Config table)
    console.log('API: Using hard-coded field mappings');
    
    // Define field mappings directly (no config object needed)
    const MILESTONE_NAME_FIELD = 'Name';
    const MILESTONE_DEADLINE_FIELD = 'Deadline';
    const MILESTONE_PRIORITY_NAME_FIELD = 'Priority';
    const MILESTONE_STATUS_FIELD = 'Status';
    const MILESTONE_ACCOUNTABLE_FIELD = 'Accountable';
    const MILESTONE_START_FIELD = 'Start date';
    
    const ACTION_NAME_FIELD = 'Name';
    const ACTION_RESPONSIBLE_FIELD = 'Responsible';
    const ACTION_DEADLINE_FIELD = 'Deadline';
    const ACTION_STATUS_FIELD = 'Status';
    const ACTION_TPW_ROLE_FIELD = 'Current Status (TPW Role)';
    const ACTION_DIRECTOR_VIEW_FIELD = 'Director View';

    // Fetch Milestones with pagination
    console.log('API: Fetching Milestones...');
    const milestonesData = await fetchAllRecords(base('Milestones').select({
      fields: [
        MILESTONE_NAME_FIELD,
        MILESTONE_DEADLINE_FIELD,
        MILESTONE_PRIORITY_NAME_FIELD,
        MILESTONE_STATUS_FIELD,
        MILESTONE_ACCOUNTABLE_FIELD,
        MILESTONE_START_FIELD
      ]
    }));
    console.log('API: Milestones fetched:', milestonesData.length);

    // Fetch Actions with pagination
    console.log('API: Fetching Actions...');
    const actionsData = await fetchAllRecords(base('Actions').select({
      fields: [
        ACTION_NAME_FIELD,
        ACTION_RESPONSIBLE_FIELD,
        ACTION_DEADLINE_FIELD,
        ACTION_STATUS_FIELD,
        ACTION_TPW_ROLE_FIELD,
        ACTION_DIRECTOR_VIEW_FIELD
      ]
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
      name: record.fields[MILESTONE_NAME_FIELD] || '',
      deadline: record.fields[MILESTONE_DEADLINE_FIELD] || '',
      priority: Array.isArray(record.fields[MILESTONE_PRIORITY_NAME_FIELD]) 
        ? record.fields[MILESTONE_PRIORITY_NAME_FIELD][0] 
        : record.fields[MILESTONE_PRIORITY_NAME_FIELD] || '',
      status: record.fields[MILESTONE_STATUS_FIELD] || '',
      accountable: record.fields[MILESTONE_ACCOUNTABLE_FIELD] || '',
      startDate: record.fields[MILESTONE_START_FIELD] || ''
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
        const tpwRole = record.fields[ACTION_TPW_ROLE_FIELD];
        const directorView = record.fields[ACTION_DIRECTOR_VIEW_FIELD];
        return tpwRole === 'Current' && directorView === true;
      })
      .map(record => {
        const responsibleField = record.fields[ACTION_RESPONSIBLE_FIELD];
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
          name: record.fields[ACTION_NAME_FIELD] || '',
          responsible: responsible,
          deadline: record.fields[ACTION_DEADLINE_FIELD] || '',
          status: record.fields[ACTION_STATUS_FIELD] || '',
          tpwRole: record.fields[ACTION_TPW_ROLE_FIELD] || '',
          directorView: record.fields[ACTION_DIRECTOR_VIEW_FIELD] || false
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
        directorViewFieldName: ACTION_DIRECTOR_VIEW_FIELD
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
