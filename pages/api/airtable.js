export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const Airtable = require('airtable');
  const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

  try {
    console.log('API: Starting data fetch...');

    // Helper function to fetch all records with pagination
    async function fetchAllRecords(query) {
      let allRecords = [];
      let records = await query.firstPage();
      allRecords = [...records];
      
      while (query.offset) {
        records = await query.eachPage();
        allRecords = [...allRecords, ...records];
      }
      
      return allRecords;
    }

    // Fetch Config table for dynamic field mapping
    console.log('API: Fetching Config...');
    let config = {};
    try {
      const configData = await fetchAllRecords(base('Config').select());
      config = Object.fromEntries(
        configData.map(record => [record.fields.Key, record.fields.Value])
      );
      console.log('API: Config loaded:', Object.keys(config));
    } catch (configError) {
      console.log('API: Config table not found, using defaults');
    }

    // Define field mappings with fallbacks
    const MILESTONE_NAME_FIELD = config['milestone_name_field'] || 'Name';
    const MILESTONE_DEADLINE_FIELD = config['milestone_deadline_field'] || 'Deadline';
    const MILESTONE_PRIORITY_NAME_FIELD = config['milestone_priority_name_field'] || 'Priority';
    const MILESTONE_STATUS_FIELD = config['milestone_status_field'] || 'Status';
    const MILESTONE_ACCOUNTABLE_FIELD = config['milestone_accountable_field'] || 'Accountable';
    const MILESTONE_START_FIELD = config['milestone_start_field'] || 'Start Date';
    
    const ACTION_NAME_FIELD = config['action_name_field'] || 'Name';
    const ACTION_RESPONSIBLE_FIELD = config['action_responsible_field'] || 'Responsible';
    const ACTION_DEADLINE_FIELD = config['action_deadline_field'] || 'Deadline';
    const ACTION_STATUS_FIELD = config['action_status_field'] || 'Status';
    const ACTION_TPW_ROLE_FIELD = config['action_tpw_role_field'] || 'Current Status (TPW Role)';
    const ACTION_DIRECTOR_VIEW_FIELD = config['action_director_view_field'] || 'Director View';

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
    console.log('API: Sample action fields:', actionsData[0]?.fields ? Object.keys(actionsData[0].fields) : 'No actions found');

    // Fetch People table with pagination
    console.log('API: Fetching People...');
    let peopleData = [];
    try {
      const PEOPLE_TABLE_NAME = config['people_table_name'] || 'People';
      peopleData = await fetchAllRecords(base(PEOPLE_TABLE_NAME).select({
        fields: ['Name']
      }));
      console.log('API: People fetched:', peopleData.length);
    } catch (peopleError) {
      console.log('API: People table not found or error:', peopleError);
    }

    // Fetch Priorities table with pagination
    console.log('API: Fetching Priorities...');
    let prioritiesData = [];
    try {
      prioritiesData = await fetchAllRecords(base('Priorities').select({
        fields: ['Name']
      }));
      console.log('API: Priorities fetched:', prioritiesData.length);
    } catch (prioritiesError) {
      console.log('API: Priorities table not found or error:', prioritiesError);
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
    console.log('API: PeopleMap created with', Object.keys(peopleMap).length, 'entries');

    // Process actions
    console.log('API: Sample action before filtering:', actionsData[0]?.fields);
    console.log('API: ACTION_DIRECTOR_VIEW_FIELD:', ACTION_DIRECTOR_VIEW_FIELD);
    
    const actions = actionsData
      .filter(record => {
        // Filter by TPW Role = 'Current' AND Director View = true
        const tpwRole = record.fields[ACTION_TPW_ROLE_FIELD];
        const directorView = record.fields[ACTION_DIRECTOR_VIEW_FIELD];
        
        console.log('API: Record', record.id, 'TPW Role:', tpwRole, 'Director View:', directorView);
        
        const passesFilter = tpwRole === 'Current' && directorView === true;
        if (!passesFilter) {
          console.log('API: Record', record.id, 'filtered out - TPW Role:', tpwRole, 'Director View:', directorView);
        }
        
        return passesFilter;
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

    console.log('API: Total actions before filtering:', actionsData.length);
    console.log('API: Actions after TPW Role + Director View filtering:', actions.length);
    console.log('API: Processed', milestones.length, 'milestones and', actions.length, 'actions');

    const response = {
      milestones,
      actions,
      peopleMap,
      prioritiesMap: {}
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('API: Error fetching data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch data', 
      details: error.message,
      stack: error.stack 
    });
  }
}
