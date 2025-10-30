import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, X, Download } from 'lucide-react';

export default function GanttChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMilestones, setExpandedMilestones] = useState({});
  const [expandedPriorities, setExpandedPriorities] = useState({
    p1: true, p2: true, p3: true, p4: true
  });
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [sortByDate, setSortByDate] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/airtable');
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const months = [
    { label: 'Aug 25', value: 1 },
    { label: 'Sep 25', value: 2 },
    { label: 'Oct 25', value: 3 },
    { label: 'Nov 25', value: 4 },
    { label: 'Dec 25', value: 5 },
    { label: 'Jan 26', value: 6 },
    { label: 'Feb 26', value: 7 },
    { label: 'Mar 26', value: 8 },
    { label: 'Apr 26', value: 9 },
    { label: 'May 26', value: 10 },
    { label: 'Jun 26', value: 11 },
    { label: 'Jul 26', value: 12 }
  ];

  const dateToMonth = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const baseDate = new Date('2025-08-01');
    const diffMonths = (date.getFullYear() - baseDate.getFullYear()) * 12 + 
                       (date.getMonth() - baseDate.getMonth());
    return Math.max(1, Math.min(12, diffMonths + 1));
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
    const width = (end - start + 1) * 8.33;
    const left = ((start - 1) * 8.33);
    return { left: `${left}%`, width: `${width}%` };
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading Gantt chart from Airtable...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    );
  }

  // Group milestones by priority
  const priorityGroups = {};
  data?.milestones.forEach(milestone => {
    const priorityIds = milestone.fields['Priority (from Projects)'] || [];
    priorityIds.forEach(priorityId => {
      const priority = data.projects.find(p => p.id === priorityId);
      if (priority) {
        const priorityName = priority.fields.Name;
        if (!priorityGroups[priorityName]) {
          priorityGroups[priorityName] = [];
        }
        priorityGroups[priorityName].push(milestone);
      }
    });
  });

  return (
    <div className="w-full bg-white p-6 overflow-x-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            TPW North-East & Cumbria Regional Delivery Action Plan
          </h1>
          <p className="text-sm text-gray-600">August 2025 - July 2026 (Year 1) - Live from Airtable</p>
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
        {/* Header */}
        <div className="flex mb-4">
          <div className="w-80 px-4 py-2 flex items-center justify-between">
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

        {/* Timeline Grid */}
        {Object.entries(priorityGroups).map(([priorityName, milestones]) => (
          <div key={priorityName} className="mb-6">
            {/* Priority Header */}
            <div 
              className="flex items-center bg-gray-100 px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors rounded"
              onClick={() => togglePriority(priorityName)}
            >
              {expandedPriorities[priorityName] ? 
                <ChevronDown className="w-5 h-5 mr-2" /> : 
                <ChevronRight className="w-5 h-5 mr-2" />
              }
              <span className="font-bold text-gray-800">{priorityName}</span>
            </div>

            {/* Milestones */}
            {expandedPriorities[priorityName] && milestones.map((milestone) => {
              const actionIds = milestone.fields.Actions || [];
              const milestoneActions = data.actions.filter(a => actionIds.includes(a.id));
              const isExpanded = expandedMilestones[milestone.id];
              
              // Calculate milestone start from earliest action
              let milestoneStart = dateToMonth(milestone.fields.Deadline);
              let milestoneEnd = milestoneStart;
              
              if (milestoneActions.length > 0) {
                const actionStarts = milestoneActions.map(a => dateToMonth(a.fields['Start date'])).filter(Boolean);
                const actionEnds = milestoneActions.map(a => dateToMonth(a.fields['End date'])).filter(Boolean);
                if (actionStarts.length > 0) milestoneStart = Math.min(...actionStarts);
                if (actionEnds.length > 0) milestoneEnd = Math.max(...actionEnds, milestoneEnd);
              }

              const expectedDeadline = milestone.fields['Expected deadline'];
              const isAtRisk = expectedDeadline && dateToMonth(expectedDeadline) > dateToMonth(milestone.fields.Deadline);

              return (
                <div key={milestone.id}>
                  {/* Milestone Row */}
                  <div className="flex items-center border-b border-gray-100 hover:bg-gray-50">
                    <div className="w-80 px-4 py-3 text-sm text-gray-700 flex items-center gap-2">
                      {milestoneActions.length > 0 && (
                        <button onClick={() => toggleMilestone(milestone.id)} className="text-gray-500 hover:text-gray-700">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}
                      <span className="font-medium">{milestone.fields.Name}</span>
                      {isAtRisk && <span className="text-xs text-red-600 font-semibold">⚠ At Risk</span>}
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
                            {months[milestoneStart - 1].label} - {months[milestoneEnd - 1].label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Actions */}
                  {isExpanded && milestoneActions.map((action) => {
                    const actionStart = dateToMonth(action.fields['Start date']);
                    const actionEnd = dateToMonth(action.fields['End date']);
                    const status = action.fields.Status || 'Not Started';
                    const statusColor = status === 'Complete' ? 'bg-green-500' : 
                                       status === 'In Progress' ? 'bg-yellow-500' : 'bg-gray-400';

                    return (
                      <div key={action.id} className="flex items-center border-b border-gray-50 bg-gray-50">
                        <div className="w-80 px-4 py-2 text-xs text-gray-600 pl-16">
                          ↳ {action.fields.Name}
                          <span className={`ml-2 px-2 py-0.5 rounded text-white ${statusColor}`}>
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
                                {months[actionStart - 1].label} - {months[actionEnd - 1].label}
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
