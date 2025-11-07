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

    // Try to fetch Config table, fall back to defaults if it fails
    console.log('API: Fetching Config table...');
    let config = {};
    
    try {
      const configData = await fetchAllRecords(base('Config').select({
        fields: ['Key', 'Value']
      }));
      
      console.log('API: Config records found:', configData.length);
      
      // Convert config array to object
      configData.forEach(record => {
        const key = record.fields.Key;
        const value = record.fields.Value;
        if (key && value) {
          config[key] = value;
        }
      });
      
      console.log('API: Config keys loaded:', Object.keys(config));
      
    } catch (configError) {
      console.log('API: Config table fetch failed, using defaults:', configError.message);
      
      // Use default config values that match your table
      config = {
        'milestone_name_field': 'Name',
        'milestone_deadline_field': 'Deadline',
        'milestone_priority_name_field': 'Priority',
        'milestone_status_field': 'Status',
        'milestone_accountable_field': 'Accountable',
        'milestone_start_field': 'Start date',
        'action_name_field': 'Name',
        'action_responsible_field': 'Responsible',
        'action_deadline_field': 'Deadline',
        'action_status_field': 'Status',
        'action_tpw_role_field': 'Current Status (TPW Role)',
        'action_director_view_field': 'Director View'
      };
    }

    // Get field names from config with fallbacks
    const getField = (configKey, fallback) => config[configKey] || fallback;
    
    const MILESTONE_NAME_FIELD = getField('milestone_name_field', 'Name');
    const MILESTONE_DEADLINE_FIELD = getField('milestone_deadline_field', 'Deadline');
    const MILESTONE_PRIORITY_NAME_FIELD = getField('milestone_priority_name_field', 'Priority');
    const MILESTONE_STATUS_FIELD = getField('milestone_status_field', 'Status');
    const MILESTONE_ACCOUNTABLE_FIELD = getField('milestone_accountable_field', 'Accountable');
    const MILESTONE_START_FIELD = getField('milestone_start_field', 'Start date');
    
    const ACTION_NAME_FIELD = getField('action_name_field', 'Name');
    const ACTION_RESPONSIBLE_FIELD = getField('action_responsible_field', 'Responsible');
    const ACTION_DEADLINE_FIELD = getField('action_deadline_field', 'Deadline');
    const ACTION_STATUS_FIELD = getField('action_status_field', 'Status');
    const ACTION_TPW_ROLE_FIELD = getField('action_tpw_role_field', 'Current Status (TPW Role)');
    const ACTION_DIRECTOR_VIEW_FIELD = getField('action_director_view_field', 'Director View');
    const ACTION_NOTES_FIELD = getField('action_notes_field', 'Notes');

    console.log('API: Using field mappings - Milestone name:', MILESTONE_NAME_FIELD, 'Action director view:', ACTION_DIRECTOR_VIEW_FIELD);

    // Fetch Milestones
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

    // Fetch Actions
    console.log('API: Fetching Actions...');
    const actionsData = await fetchAllRecords(base('Actions').select({
      fields: [
        ACTION_NAME_FIELD,
        ACTION_RESPONSIBLE_FIELD,
        ACTION_DEADLINE_FIELD,
        ACTION_STATUS_FIELD,
        ACTION_TPW_ROLE_FIELD,
        ACTION_DIRECTOR_VIEW_FIELD,
        getField('action_notes_field', 'Notes')
      ]
    }));
    console.log('API: Actions fetched:', actionsData.length);

    // Fetch People
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

    // Fetch Notes table (if Notes field is linked)
    console.log('API: Fetching Notes...');
    let notesData = [];
    try {
      notesData = await fetchAllRecords(base('Notes').select({
        fields: ['Description']
      }));
      console.log('API: Notes fetched:', notesData.length);
    } catch (notesError) {
      console.log('API: Notes table error, continuing without it:', notesError.message);
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

    // Create people map
    const peopleMap = {};
    peopleData.forEach(record => {
      peopleMap[record.id] = record.fields.Name || 'Unknown';
    });

    // Create notes map for linked notes
    const notesMap = {};
    notesData.forEach(record => {
      notesMap[record.id] = record.fields.Description || '';
    });
    console.log('API: Notes map created with', Object.keys(notesMap).length, 'entries');
    console.log('API: Sample notes map entries:', Object.entries(notesMap).slice(0, 3));

    // Process actions with Director View filtering
    console.log('API: Filtering actions by Director View and TPW Role...');
    const actions = actionsData
      .filter(record => {
        const tpwRole = record.fields[ACTION_TPW_ROLE_FIELD];
        const directorView = record.fields[ACTION_DIRECTOR_VIEW_FIELD];
        return tpwRole === 'Current' && directorView === true;
      })
      .map(record => {
        const responsibleField = record.fields[ACTION_RESPONSIBLE_FIELD];
        let responsible = 'Unassigned';

        if (Array.isArray(responsibleField) && responsibleField.length > 0) {
          const responsibleId = responsibleField[0];
          responsible = peopleMap[responsibleId] || 'Unknown';
        } else if (typeof responsibleField === 'string') {
          responsible = responsibleField;
        }

        // Handle notes field - could be linked record or text
        const notesField = record.fields[ACTION_NOTES_FIELD];
        let notes = '';
        
        if (Array.isArray(notesField) && notesField.length > 0) {
          // Linked record - look up in notesMap
          const notesId = notesField[0];
          notes = notesMap[notesId] || '';
        } else if (typeof notesField === 'string') {
          // Direct text field
          notes = notesField;
        }

        return {
          id: record.id,
          name: record.fields[ACTION_NAME_FIELD] || '',
          responsible: responsible,
          deadline: record.fields[ACTION_DEADLINE_FIELD] || '',
          status: record.fields[ACTION_STATUS_FIELD] || '',
          tpwRole: record.fields[ACTION_TPW_ROLE_FIELD] || '',
          directorView: record.fields[ACTION_DIRECTOR_VIEW_FIELD] || false,
          notes: notes
        };
      });

    console.log('API: Actions after filtering:', actions.length, 'out of', actionsData.length);

    const response = {
      milestones,
      actions,
      peopleMap,
      prioritiesMap: {},
      config: config, // Include config in response for frontend
      debug: {
        totalActionsBeforeFilter: actionsData.length,
        totalActionsAfterFilter: actions.length,
        configKeys: Object.keys(config),
        fieldMappings: {
          milestone_name: MILESTONE_NAME_FIELD,
          action_director_view: ACTION_DIRECTOR_VIEW_FIELD
        }
      }
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
