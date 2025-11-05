export default async function handler(req, res) {
  // Try different possible environment variable names
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || 
                         process.env.AIRTABLE_API_KEY || 
                         process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
  
  const BASE_ID = process.env.AIRTABLE_BASE_ID || 
                  process.env.BASE_ID ||
                  process.env.AIRTABLE_BASE;

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return res.status(500).json({ 
      error: 'Missing Airtable credentials',
      message: 'Please set AIRTABLE_TOKEN and AIRTABLE_BASE_ID environment variables',
      debug: {
        hasToken: !!AIRTABLE_TOKEN,
        hasBaseId: !!BASE_ID,
        availableEnvVars: Object.keys(process.env).filter(key => key.includes('AIRTABLE'))
      }
    });
  }

  try {
    // Step 1: Fetch Config table to get field mappings
    const configResponse = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/Config`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        },
      }
    );

    if (!configResponse.ok) {
      throw new Error(`Failed to fetch Config table: ${configResponse.statusText}`);
    }

    const configData = await configResponse.json();
    
    // Convert config records into a key-value object
    const config = {};
    configData.records.forEach(record => {
      const key = record.fields.Key;
      const value = record.fields.Value;
      if (key && value) {
        config[key] = value;
      }
    });

    // Validate required config keys
    const requiredKeys = [
      'milestone_name_field',
      'milestone_deadline_field',
      'milestone_priority_id_field',
      'milestone_priority_name_field'
    ];

    const missingKeys = requiredKeys.filter(key => !config[key]);
    if (missingKeys.length > 0) {
      return res.status(500).json({
        error: 'Missing required config keys',
        missingKeys,
        message: 'Please add these keys to your Config table in Airtable'
      });
    }

    // Step 2: Fetch Milestones table
    const milestonesResponse = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/Milestones`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        },
      }
    );

    if (!milestonesResponse.ok) {
      throw new Error(`Failed to fetch Milestones: ${milestonesResponse.statusText}`);
    }

    const milestonesData = await milestonesResponse.json();

    // Step 3: Return both config and milestones
    res.status(200).json({
      config,
      milestones: milestonesData.records
    });

  } catch (error) {
    console.error('Airtable API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch data from Airtable',
      message: error.message 
    });
  }
}
