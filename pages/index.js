// VERSION: 3.1 - Director View Filter + Expandable Notes
// LAST UPDATED: 2025-11-06
// FEATURES: Dynamic config, Status/Accountable filters, TPW Role filter, Director View filter, Expandable Notes

import { useState, useEffect } from 'react';

export default function GanttChart() {
  const [data, setData] = useState({
    milestones: [],
    actions: [],
    peopleMap: {},
    prioritiesMap: {},
    config: {}
  });
  const [loading, setLoading] = useState(true);
  
  // Gantt Chart State
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedAccountable, setSelectedAccountable] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [groupByPriority, setGroupByPriority] = useState(true);
  const [sortByDeadline, setSortByDeadline] = useState(false);
  
  // Actions Table State  
  const [selectedResponsible, setSelectedResponsible] = useState([]);
  const [selectedActionStatuses, setSelectedActionStatuses] = useState([]);
  const [groupByResponsible, setGroupByResponsible] = useState(true);
  const [groupByStatus, setGroupByStatus] = useState(false);
  const [sortBy, setSortBy] = useState('deadline');
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  
  // Tab state
  const [activeTab, setActiveTab] = useState('gantt');

  const { milestones, actions, peopleMap, prioritiesMap, config } = data;

  // Dynamic field mapping from Config table
  const MILESTONE_NAME_FIELD = config.milestone_name_field || 'Name';
  const MILESTONE_DEADLINE_FIELD = config.milestone_deadline_field || 'Deadline';
  const MILESTONE_PRIORITY_ID_FIELD = config.milestone_priority_id_field || 'Priority area';
  const MILESTONE_PRIORITY_NAME_FIELD = config.milestone_priority_name_field || 'Priority';
  const MILESTONE_ACTIVITIES_FIELD = config.milestone_activities_field || 'Activities';
  const MILESTONE_START_FIELD = config.milestone_start_field || 'Start Date';
  const MILESTONE_ACCOUNTABLE_FIELD = config.milestone_accountable_field || 'Accountable';
  const MILESTONE_STATUS_FIELD = config.milestone_status_field || 'Status';
  
  const ACTION_NAME_FIELD = config.action_name_field || 'Name';
  const ACTION_RESPONSIBLE_FIELD = config.action_responsible_field || 'Responsible';
  const ACTION_DEADLINE_FIELD = config.action_deadline_field || 'Deadline';
  const ACTION_STATUS_FIELD = config.action_status_field || 'Status';
  const ACTION_TPW_ROLE_FIELD = config.action_tpw_role_field || 'Current Status (TPW Role)';
  const ACTION_DIRECTOR_VIEW_FIELD = config.action_director_view_field || 'Director View';
  const ACTION_NOTES_FIELD = config.action_notes_field || 'Notes';

  useEffect(() => {
    fetch('/api/airtable')
      .then(response => response.json())
      .then(data => {
        console.log('=== API RESPONSE DEBUG ===');
        console.log('Data received:', data);
        
        setData(data);
        
        // Extract unique values for filters (AFTER setting data)
        const priorities = [...new Set(data.milestones
          .map(m => {
            // Use priority name field directly if it exists, otherwise map from priority IDs
            const priorityName = m.fields[data.config?.milestone_priority_name_field || 'Priority'];
            if (priorityName && Array.isArray(priorityName) && priorityName.length > 0) {
              return priorityName[0];
            } else if (typeof priorityName === 'string') {
              return priorityName;
            }
            // Fallback to mapping from priority IDs
            const priorityIds = m.fields[data.config?.milestone_priority_id_field || 'Priority area'];
            if (priorityIds && priorityIds.length > 0) {
              return data.prioritiesMap[priorityIds[0]] || 'Unknown';
            }
            return 'Unknown';
          })
          .filter(Boolean)
        )];
        
        const milestoneStatuses = [...new Set(data.milestones
          .map(m => m.fields[data.config?.milestone_status_field || 'Status'])
          .filter(Boolean)
        )];
        
        const accountablePeople = [...new Set(data.milestones
          .map(m => {
            const accountableField = m.fields[data.config?.milestone_accountable_field || 'Accountable'];
            // Handle both linked records and single select fields
            if (Array.isArray(accountableField) && accountableField.length > 0) {
              return data.peopleMap[accountableField[0]] || 'Unknown';
            } else if (typeof accountableField === 'string') {
              return accountableField;
            }
            return 'Unassigned';
          })
          .filter(Boolean)
        )];

        console.log('All priorities:', priorities);
        console.log('All accountable people:', accountablePeople);  
        console.log('All statuses:', milestoneStatuses);
        
        setSelectedPriorities(priorities);
        setSelectedStatuses(milestoneStatuses);
        setSelectedAccountable(accountablePeople); // Include all accountable people
        
        // Process actions for Actions tab
        const currentActions = data.actions.filter(action => {
          const tpwRole = action.fields[data.config?.action_tpw_role_field || 'Current Status (TPW Role)'];
          const directorView = action.fields[data.config?.action_director_view_field || 'Director View'];
          return tpwRole === 'Current' && directorView === true;
        });
        
        console.log('Total actions:', data.actions.length);
        console.log('Actions with TPW Role "Current":', data.actions.filter(a => a.fields[data.config?.action_tpw_role_field || 'Current Status (TPW Role)'] === 'Current').length);
        console.log('Actions with Director View true:', currentActions.length);
        
        const responsiblePeople = [...new Set(currentActions
          .map(action => {
            const responsibleField = action.fields[data.config?.action_responsible_field || 'Responsible'];
            // Handle both linked records and single select fields
            if (Array.isArray(responsibleField) && responsibleField.length > 0) {
              return data.peopleMap[responsibleField[0]] || 'Unknown';
            } else if (typeof responsibleField === 'string') {
              return responsibleField;
            }
            return 'Unknown';
          })
          .filter(Boolean)
        )];
        
        const actionStatuses = [...new Set(currentActions
          .map(action => action.fields[data.config?.action_status_field || 'Status'])
          .filter(Boolean)
        )];
        
        console.log('All responsible people:', responsiblePeople);
        console.log('All action statuses:', actionStatuses);
        
        setSelectedResponsible(responsiblePeople);
        setSelectedActionStatuses(actionStatuses);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setLoading(false);
      });
  }, []);

  // Toggle functions for Gantt filters
  const togglePriority = (priority) => {
    setSelectedPriorities(prev =>
      prev.includes(priority)
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    );
  };

  const toggleAccountable = (person) => {
    setSelectedAccountable(prev =>
      prev.includes(person)
        ? prev.filter(p => p !== person)
        : [...prev, person]
    );
  };

  const toggleStatus = (status) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Toggle functions for Actions filters  
  const toggleResponsible = (person) => {
    setSelectedResponsible(prev =>
      prev.includes(person)
        ? prev.filter(p => p !== person)
        : [...prev, person]
    );
  };

  const toggleActionStatus = (status) => {
    setSelectedActionStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Note expansion toggle
  const toggleNoteExpansion = (actionId) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      return newSet;
    });
  };

  // Process chart data based on filters
  const processedChartData = milestones.map(milestone => {
    const priorityName = milestone.fields[MILESTONE_PRIORITY_NAME_FIELD];
    let priority;
    if (priorityName && Array.isArray(priorityName) && priorityName.length > 0) {
      priority = priorityName[0];
    } else if (typeof priorityName === 'string') {
      priority = priorityName;
    } else {
      // Fallback to mapping from priority IDs
      const priorityIds = milestone.fields[MILESTONE_PRIORITY_ID_FIELD];
      priority = (priorityIds && priorityIds.length > 0) ? prioritiesMap[priorityIds[0]] || 'Unknown' : 'Unknown';
    }

    const accountableField = milestone.fields[MILESTONE_ACCOUNTABLE_FIELD];
    let accountable;
    if (Array.isArray(accountableField) && accountableField.length > 0) {
      accountable = peopleMap[accountableField[0]] || 'Unknown';
    } else if (typeof accountableField === 'string') {
      accountable = accountableField;
    } else {
      accountable = 'Unassigned';
    }

    const status = milestone.fields[MILESTONE_STATUS_FIELD] || 'Unknown';
    const deadline = milestone.fields[MILESTONE_DEADLINE_FIELD];
    
    // Use actual start date if available, otherwise estimate 3 months before deadline
    let startDate;
    const actualStartDate = milestone.fields[MILESTONE_START_FIELD];
    if (actualStartDate) {
      startDate = actualStartDate;
    } else if (deadline) {
      const deadlineDate = new Date(deadline);
      deadlineDate.setMonth(deadlineDate.getMonth() - 3);
      startDate = deadlineDate.toISOString().split('T')[0];
    } else {
      startDate = new Date().toISOString().split('T')[0];
    }

    return {
      id: milestone.id,
      name: milestone.fields[MILESTONE_NAME_FIELD] || 'Untitled',
      priority,
      accountable,
      status,
      startDate,
      deadline
    };
  });

  // Apply filters to chart data
  const filteredChartData = processedChartData.filter(item => {
    return selectedPriorities.includes(item.priority) &&
           selectedAccountable.includes(item.accountable) &&
           selectedStatuses.includes(item.status);
  });

  console.log('Selected priorities:', selectedPriorities);
  console.log('Selected accountable:', selectedAccountable);
  console.log('Selected statuses:', selectedStatuses);
  console.log('After filters:', filteredChartData.length);

  // Sort and group chart data
  let displayData = [...filteredChartData];
  
  if (sortByDeadline) {
    displayData.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
  }

  // Process actions data
  const processedActions = actions
    .filter(action => {
      const tpwRole = action.fields[ACTION_TPW_ROLE_FIELD];
      const directorView = action.fields[ACTION_DIRECTOR_VIEW_FIELD];
      return tpwRole === 'Current' && directorView === true;
    })
    .map(action => {
      const responsibleField = action.fields[ACTION_RESPONSIBLE_FIELD];
      let responsible;
      if (Array.isArray(responsibleField) && responsibleField.length > 0) {
        responsible = peopleMap[responsibleField[0]] || 'Unknown';
      } else if (typeof responsibleField === 'string') {
        responsible = responsibleField;
      } else {
        responsible = 'Unknown';
      }

      return {
        id: action.id,
        name: action.fields[ACTION_NAME_FIELD] || 'Untitled',
        responsible,
        deadline: action.fields[ACTION_DEADLINE_FIELD] || '',
        status: action.fields[ACTION_STATUS_FIELD] || 'Unknown',
        notes: action.fields[ACTION_NOTES_FIELD] || ''
      };
    });

  // Apply filters to actions
  const filteredActions = processedActions.filter(action => {
    return selectedResponsible.includes(action.responsible) &&
           selectedActionStatuses.includes(action.status);
  });

  // Sort actions by deadline
  const sortedActions = [...filteredActions].sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  // Group actions if needed
  let groupedActions = {};
  if (groupByResponsible) {
    groupedActions = sortedActions.reduce((groups, action) => {
      const key = action.responsible || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(action);
      return groups;
    }, {});
  } else if (groupByStatus) {
    groupedActions = sortedActions.reduce((groups, action) => {
      const key = action.status || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(action);
      return groups;
    }, {});
  }

  // Get priority color
  const getPriorityColor = (priority) => {
    const colors = {
      '2. Grant making': '#10b981', // Green
      '3. Capability support and development': '#eab308', // Yellow  
      '4. Learning and Impact': '#8b5cf6', // Purple
      '1. Governance and Leadership': '#ef4444' // Red
    };
    return colors[priority] || '#6b7280';
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    const colors = {
      'Not started': 'bg-gray-100 text-gray-800',
      'In progress': 'bg-blue-100 text-blue-800',
      'Complete': 'bg-green-100 text-green-800',
      'On hold': 'bg-orange-100 text-orange-800',
      'Cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Generate timeline months
  const generateTimeline = () => {
    const months = [];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 2);
    
    for (let i = 0; i < 24; i++) {
      const date = new Date(startDate);
      date.setMonth(startDate.getMonth() + i);
      months.push({
        label: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
        date: date
      });
    }
    return months;
  };

  const timelineMonths = generateTimeline();

  // Calculate bar position and width
  const getBarStyle = (startDate, deadline) => {
    if (!deadline) return { display: 'none' };
    
    const start = new Date(startDate);
    const end = new Date(deadline);
    const timelineStart = timelineMonths[0].date;
    const timelineEnd = new Date(timelineMonths[timelineMonths.length - 1].date);
    timelineEnd.setMonth(timelineEnd.getMonth() + 1);
    
    const totalDuration = timelineEnd - timelineStart;
    const itemStart = start - timelineStart;
    const itemDuration = end - start;
    
    const leftPercent = Math.max(0, (itemStart / totalDuration) * 100);
    const widthPercent = Math.min(100 - leftPercent, (itemDuration / totalDuration) * 100);
    
    return {
      left: `${leftPercent}%`,
      width: `${Math.max(2, widthPercent)}%`
    };
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">TPW Regional Delivery Action Plan</h1>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('gantt')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'gantt'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Gantt Chart
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'actions'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Actions
          </button>
        </div>

        {activeTab === 'gantt' && (
          <div className="space-y-6">
            {/* Gantt Chart Filters */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              
              {/* Priority Filter */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Filter by Priority Area</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedPriorities([...new Set(processedChartData.map(d => d.priority))])}
                    className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedPriorities([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                  {[...new Set(processedChartData.map(d => d.priority))].map(priority => (
                    <button
                      key={priority}
                      onClick={() => togglePriority(priority)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedPriorities.includes(priority)
                          ? 'border-green-500 bg-green-50 text-green-800'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                      style={{
                        borderColor: selectedPriorities.includes(priority) ? getPriorityColor(priority) : undefined,
                        backgroundColor: selectedPriorities.includes(priority) ? `${getPriorityColor(priority)}20` : undefined
                      }}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Filter by Status</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedStatuses([...new Set(processedChartData.map(d => d.status))])}
                    className="px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded-full hover:bg-purple-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedStatuses([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                  {[...new Set(processedChartData.map(d => d.status))].map(status => (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedStatuses.includes(status)
                          ? 'border-purple-500 bg-purple-50 text-purple-800'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accountable Filter */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Filter by Accountable</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedAccountable([...new Set(processedChartData.map(d => d.accountable))])}
                    className="px-3 py-1 text-xs bg-cyan-100 text-cyan-800 rounded-full hover:bg-cyan-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedAccountable([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                  {[...new Set(processedChartData.map(d => d.accountable))].map(person => (
                    <button
                      key={person}
                      onClick={() => toggleAccountable(person)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedAccountable.includes(person)
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {person}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Options */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">View Options</h3>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={groupByPriority}
                      onChange={(e) => setGroupByPriority(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Group by Priority</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={sortByDeadline}
                      onChange={(e) => setSortByDeadline(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Sort by Deadline</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Gantt Chart */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Milestone Timeline</h2>
                
                {/* Timeline Header */}
                <div className="flex border-b border-gray-200 pb-2 mb-4">
                  <div className="w-96 px-4 py-2 font-medium text-gray-700">Milestone</div>
                  <div className="flex-1 relative">
                    <div className="flex">
                      {timelineMonths.map((month, index) => (
                        <div
                          key={index}
                          className="flex-1 px-1 py-2 text-center text-xs font-medium text-gray-600 border-r border-gray-100 last:border-r-0"
                        >
                          {month.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Milestones */}
                <div className="space-y-1">
                  {groupByPriority ? (
                    // Grouped view
                    [...new Set(displayData.map(d => d.priority))].map(priority => (
                      <div key={priority} className="mb-4">
                        <div className="mb-2 px-4 py-2 bg-gray-50 rounded-lg">
                          <h3 className="font-medium text-gray-900">{priority}</h3>
                        </div>
                        {displayData
                          .filter(item => item.priority === priority)
                          .map(item => (
                            <div key={item.id} className="flex items-center border-b border-gray-100 py-2 hover:bg-gray-50">
                              <div className="w-96 px-4">
                                <div className="font-medium text-sm text-gray-900">{item.name}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Status: {item.status} | Accountable: {item.accountable}
                                </div>
                              </div>
                              <div className="flex-1 relative h-8">
                                <div
                                  className="absolute top-1 h-6 rounded opacity-75"
                                  style={{
                                    backgroundColor: getPriorityColor(item.priority),
                                    ...getBarStyle(item.startDate, item.deadline)
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    ))
                  ) : (
                    // Flat view
                    displayData.map(item => (
                      <div key={item.id} className="flex items-center border-b border-gray-100 py-2 hover:bg-gray-50">
                        <div className="w-96 px-4">
                          <div className="font-medium text-sm text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Priority: {item.priority} | Status: {item.status} | Accountable: {item.accountable}
                          </div>
                        </div>
                        <div className="flex-1 relative h-8">
                          <div
                            className="absolute top-1 h-6 rounded opacity-75"
                            style={{
                              backgroundColor: getPriorityColor(item.priority),
                              ...getBarStyle(item.startDate, item.deadline)
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{filteredChartData.length}</div>
                  <div className="text-sm text-gray-600">Total Milestones</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {filteredChartData.filter(item => item.status === 'Complete').length}
                  </div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {filteredChartData.filter(item => item.status === 'In progress').length}
                  </div>
                  <div className="text-sm text-gray-600">In Progress</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {filteredChartData.filter(item => item.status === 'Not started').length}
                  </div>
                  <div className="text-sm text-gray-600">Not Started</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-6">
            {/* Actions Filters */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              
              {/* Responsible Filter */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Filter by Responsible</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedResponsible([...new Set(processedActions.map(d => d.responsible))])}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedResponsible([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                  {[...new Set(processedActions.map(d => d.responsible))].map(person => (
                    <button
                      key={person}
                      onClick={() => toggleResponsible(person)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedResponsible.includes(person)
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {person}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Filter by Status</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedActionStatuses([...new Set(processedActions.map(d => d.status))])}
                    className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedActionStatuses([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                  {[...new Set(processedActions.map(d => d.status))].map(status => (
                    <button
                      key={status}
                      onClick={() => toggleActionStatus(status)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedActionStatuses.includes(status)
                          ? 'border-green-500 bg-green-50 text-green-800'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Options */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">View Options</h3>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="grouping"
                      checked={groupByResponsible}
                      onChange={() => {
                        setGroupByResponsible(true);
                        setGroupByStatus(false);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Group by Responsible</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="grouping"
                      checked={groupByStatus}
                      onChange={() => {
                        setGroupByResponsible(false);
                        setGroupByStatus(true);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Group by Status</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="grouping"
                      checked={!groupByResponsible && !groupByStatus}
                      onChange={() => {
                        setGroupByResponsible(false);
                        setGroupByStatus(false);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">No Grouping</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Actions</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Showing actions where Current Status (TPW Role) = Current and Director View = true
                </p>
                
                {(groupByResponsible || groupByStatus) ? (
                  // Grouped view
                  <div className="space-y-6">
                    {Object.entries(groupedActions).map(([groupKey, groupActions]) => (
                      <div key={groupKey} className="border border-gray-200 rounded-lg">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <h3 className="font-medium text-gray-900">
                            {groupByResponsible ? `${groupKey}` : `Status: ${groupKey}`}
                            <span className="ml-2 text-sm text-gray-600">({groupActions.length})</span>
                          </h3>
                        </div>
                        <div className="divide-y divide-gray-200">
                          {groupActions.map(action => (
                            <div key={action.id} className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-gray-900 flex-1">{action.name}</h4>
                                <span className={`px-2 py-1 text-xs rounded-full ml-4 ${getStatusBadgeColor(action.status)}`}>
                                  {action.status}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                {groupByStatus ? `Responsible: ${action.responsible}` : `Status: ${action.status}`}
                                {action.deadline && ` | Deadline: ${new Date(action.deadline).toLocaleDateString()}`}
                              </div>
                              {action.notes && (
                                <div className="mt-2">
                                  <button
                                    onClick={() => toggleNoteExpansion(action.id)}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                  >
                                    {expandedNotes.has(action.id) ? 'Hide Notes' : 'Show Notes'}
                                  </button>
                                  {expandedNotes.has(action.id) && (
                                    <div className="mt-2 p-3 bg-gray-50 rounded border text-sm text-gray-700">
                                      {action.notes}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Table view
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Responsible
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Deadline
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedActions.map((action, index) => (
                          <tr key={action.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{action.name}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{action.responsible}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(action.status)}`}>
                                {action.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {action.deadline ? new Date(action.deadline).toLocaleDateString() : '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {action.notes ? (
                                <button
                                  onClick={() => toggleNoteExpansion(action.id)}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  {expandedNotes.has(action.id) ? 'Hide' : 'Show'}
                                </button>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                              {expandedNotes.has(action.id) && action.notes && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                                  {action.notes}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Summary */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Summary</h2>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{filteredActions.length}</div>
                <div className="text-sm text-gray-600">Total Actions (Director View)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
