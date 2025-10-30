import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';

export default function GanttChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMilestones, setExpandedMilestones] = useState({});
  const [expandedPriorities, setExpandedPriorities] = useState({
    '1. Governance and Leadership': true,
    '2. Grant programme': true,
    '3. Infrastructure Capability Support and Development': true,
    '4. Community Involvement and Engagement': true,
    '5. Learning and impact': true
  });
  const [showAllActions, setShowAllActions] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/airtable');
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      
      console.log('Fetched data:', result);
      setData(result);
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const months = [
    { label: 'Aug 25', value: 1, date: '2025-08' },
    { label: 'Sep 25', value: 2, date: '2025-09' },
    { label: 'Oct 25', value: 3, date: '2025-10' },
    { label: 'Nov 25', value: 4, date: '2025-11' },
    { label: 'Dec 25', value: 5, date: '2025-12' },
    { label: 'Jan 26', value: 6, date: '2026-01' },
    { label: 'Feb 26', value: 7, date: '2026-02' },
    { label: 'Mar 26', value: 8, date: '2026-03' },
    { label: 'Apr 26', value: 9, date: '2026-04' },
    { label: 'May 26', value: 10, date: '2026-05' },
    { label: 'Jun 26', value: 11, date: '2026-06' },
    { label: 'Jul 26', value: 12, date: '2026-07' }
  ];

  const dateToMonth = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthObj = months.find(m => m.date === yearMonth);
      return monthObj ? monthObj.value : null;
    } catch (e) {
      return null;
    }
  };

  const toggleMilestone = (milestoneId) => {
    setExpandedMilestones(prev => ({ ...prev, [milestoneId]: !prev[milestoneId] }));
  };

  const togglePriority = (id) => {
    setExpandedPriorities(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllActions = () => {
    if (showAllActions) {
      setExpandedMilestones({});
    } else {
      const allExpanded = {};
      data?.milestones.forEach(m => {
        allExpanded[m.id] = true;
      });
      setExpandedMilestones(allExpanded);
    }
    setShowAllActions(!showAllActions);
  };

  const getBarStyle = (start, end) => {
    if (!start || !end) return { display: 'none' };
    const width = (end - start + 1) * 8.33;
    const left = ((start - 1) * 8.33);
    return { left: `${left}%`, width: `${width}%` };
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl text-gray-600 mb-2">Loading Gantt chart from Airtable...</div>
          <div className="text-sm text-gray-500">Fetching milestones and actions</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-2">Error loading data</div>
          <div className="text-sm text-gray-600">{error}</div>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Map priority IDs to names based on your Airtable
  const priorityNameMap = {
    'rec2WWPaWQHiJuvOo': '1. Governance and Leadership',
    'recBiU2a1gpJCH3jn': '2. Grant programme',
    'recdhbeustSwOr7VH': '4. Community Involvement and Engagement',
    'recIKmZArvGuwMxBS': '3. Infrastructure Capability Support and Development',
    'recw7DlH172o0BrlT': '5. Learning and impact'
  };

  // Group milestones by priority
  const priorityGroups = {};
  
  data?.milestones?.forEach(milestone => {
    const priorityIds = milestone.fields['Priority (from Projects)'] || [];
    
    priorityIds.forEach(priorityId => {
      const priorityName = priorityNameMap[priorityId] || 'Uncategorized';
      if (!priorityGroups[priorityName]) {
        priorityGroups[priorityName] = [];
      }
      if (!priorityGroups[priorityName].some(m => m.id === milestone.id)) {
        priorityGroups[priorityName].push(milestone);
      }
    });
  });

  if (Object.keys(priorityGroups).length === 0) {
    return (
      <div className="w-full p-6">
        <h1 className="text-2xl font-bold mb-4">No Data Found</h1>
        <div className="bg-gray-100 p-4 rounded">
          <p className="mb-2">Unable to group milestones by priority.</p>
          <p className="mb-2"><strong>Milestones:</strong> {data?.milestones?.length || 0}</p>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white p-6 overflow-x-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            TPW North-East & Cumbria Regional Delivery Action Plan
          </h1>
          <p className="text-sm text-gray-600">
            August 2025 - July 2026 (Year 1) - Live from Airtable
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {data?.milestones?.length || 0} milestones, {data?.actions?.length || 0} actions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleAllActions}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
              showAllActions 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {showAllActions ? 'Collapse All Actions' : 'Expand All Actions'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm print:hidden"
          >
            <Download className="w-4 h-4" />
            Export as PDF
          </button>
        </div>
      </div>

      <div className="min-w-[1200px]">
        <div className="flex mb-4">
          <div className="w-80 px-4 py-2">
            <span className="font-semibold text-gray-700">Activity</span>
          </div>
          <div className="flex-1 flex">
            {months.map((month, idx) => (
              <div key={idx} className="flex-1 text-center text-sm font-medium text-gray-600 border-l border-gray-200 py-2">
                {month.label}
              </div>
            ))}
          </div>
        </div>

        {Object.entries(priorityGroups).sort((a, b) => a[0].localeCompare(b[0])).map(([priorityName, milestones]) => (
          <div key={priorityName} className="mb-6">
            <div 
              className="flex items-center bg-gray-100 px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors rounded"
              onClick={() => togglePriority(priorityName)}
            >
              {expandedPriorities[priorityName] ? 
                <ChevronDown className="w-5 h-5 mr-2" /> : 
                <ChevronRight className="w-5 h-5 mr-2" />
              }
              <span className="font-bold text-gray-800">{priorityName}</span>
              <span className="ml-2 text-sm text-gray-600">({milestones.length})</span>
            </div>

            {expandedPriorities[priorityName] && milestones.map((milestone) => {
              const actionIds = milestone.fields.Actions || [];
              const milestoneActions = data.actions?.filter(a => actionIds.includes(a.id)) || [];
              const isExpanded = expandedMilestones[milestone.id];
              
              const deadline = dateToMonth(milestone.fields.Deadline);
              const expectedDeadline = dateToMonth(milestone.fields['Expected Completion Date']);
              
              let milestoneStart = deadline;
              let milestoneEnd = deadline;
              
              if (milestoneActions.length > 0) {
                const actionStarts = milestoneActions
                  .map(a => dateToMonth(a.fields['Start date']))
                  .filter(Boolean);
                const actionEnds = milestoneActions
                  .map(a => dateToMonth(a.fields['End date']))
                  .filter(Boolean);
                
                if (actionStarts.length > 0) milestoneStart = Math.min(...actionStarts);
                if (actionEnds.length > 0) milestoneEnd = Math.max(...actionEnds, milestoneEnd || 0);
              }

              const isAtRisk = expectedDeadline && deadline && expectedDeadline > deadline;

              return (
                <div key={milestone.id}>
                  <div className="flex items-center border-b border-gray-100 hover:bg-gray-50">
                    <div className="w-80 px-4 py-3 text-sm text-gray-700 flex items-center gap-2">
                      {milestoneActions.length > 0 && (
                        <button 
                          onClick={() => toggleMilestone(milestone.id)} 
                          className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                        >
                          {isExpanded ? 
                            <ChevronDown className="w-4 h-4" /> : 
                            <ChevronRight className="w-4 h-4" />
                          }
                        </button>
                      )}
                      <span className="font-medium">{milestone.fields.Name}</span>
                      {milestoneActions.length > 0 && (
                        <span className="text-xs text-gray-500">({milestoneActions.length})</span>
                      )}
                      {isAtRisk && (
                        <span className="text-xs text-red-600 font-semibold">⚠ At Risk</span>
                      )}
                    </div>
                    <div className="flex-1 relative h-12">
                      <div className="absolute inset-0 flex">
                        {months.map((_, i) => (
                          <div key={i} className="flex-1 border-l border-gray-200"></div>
                        ))}
                      </div>
                      {milestoneStart && milestoneEnd && (
                        <div
                          className={`absolute top-2 h-8 ${isAtRisk ? 'bg-red-500' : 'bg-blue-600'} rounded shadow-sm flex items-center justify-center transition-all hover:shadow-md opacity-90`}
                          style={getBarStyle(milestoneStart, milestoneEnd)}
                        >
                          <span className="text-xs text-white font-medium px-2 truncate">
                            {months[milestoneStart - 1]?.label} - {months[milestoneEnd - 1]?.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && milestoneActions.map((action) => {
                    const actionStart = dateToMonth(action.fields['Start date']);
                    const actionEnd = dateToMonth(action.fields['End date']);
                    const status = action.fields.Status || 'Not Started';
                    const statusColor = 
                      status === 'Done' || status === 'Complete' ? 'bg-green-500' : 
                      status === 'In progress' ? 'bg-yellow-500' : 
                      'bg-gray-400';

                    return (
                      <div key={action.id} className="flex items-center border-b border-gray-50 bg-gray-50">
                        <div className="w-80 px-4 py-2 text-xs text-gray-600 pl-16 flex items-center gap-2">
                          <span>↳ {action.fields.Name}</span>
                          <span className={`px-2 py-0.5 rounded text-white ${statusColor} text-xs`}>
                            {status}
                          </span>
                        </div>
                        <div className="flex-1 relative h-10">
                          <div className="absolute inset-0 flex">
                            {months.map((_, i) => (
                              <div key={i} className="flex-1 border-l border-gray-200"></div>
                            ))}
                          </div>
                          {actionStart && actionEnd && (
                            <div
                              className={`absolute top-1 h-6 ${statusColor} rounded shadow-sm flex items-center justify-center opacity-80`}
                              style={getBarStyle(actionStart, actionEnd)}
                            >
                              <span className="text-xs text-white font-medium px-2 truncate">
                                {months[actionStart - 1]?.label} - {months[actionEnd - 1]?.label}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
