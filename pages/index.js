import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function GanttChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPriorities, setExpandedPriorities] = useState({
    p1: true, p2: true, p3: true, p4: true, p5: true
  });

  useEffect(() => {
    fetch('/api/airtable')
      .then(response => response.json())
      .then(data => {
        console.log('Fetched data:', data);
        setData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error:', error);
        setError(error.message);
        setLoading(false);
      });
  }, []);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const togglePriority = (priorityId) => {
    setExpandedPriorities(prev => ({
      ...prev,
      [priorityId]: !prev[priorityId]
    }));
  };

  const getMonthPosition = (monthIndex) => {
    return (monthIndex * 100) / 12;
  };

  const getTaskWidth = (startMonth, endMonth) => {
    if (endMonth < startMonth) {
      // Handle year wrap-around
      return ((12 - startMonth + endMonth + 1) * 100) / 12;
    }
    return ((endMonth - startMonth + 1) * 100) / 12;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading Gantt chart from Airtable...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            TPW NE & Cumbria Regional Action Plan 2025
          </h1>
          <p className="text-gray-600 mb-6">Interactive Gantt Chart</p>

          {/* Debug info */}
          <div className="mb-4 p-4 bg-gray-100 rounded">
            <h3 className="font-bold">Data from Airtable:</h3>
            <p>Records found: {data.length}</p>
            <details>
              <summary className="cursor-pointer text-blue-600">Click to see raw data</summary>
              <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(data.slice(0, 3), null, 2)}</pre>
            </details>
          </div>

          {/* Timeline Header */}
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Month Headers */}
              <div className="flex border-b-2 border-gray-300 mb-4">
                <div className="w-80 flex-shrink-0 font-semibold p-2">Activity</div>
                <div className="flex-1 relative">
                  <div className="flex">
                    {months.map((month, index) => (
                      <div key={month} className="flex-1 text-center font-semibold p-2 border-l border-gray-200">
                        {month}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simple list of all activities from Airtable */}
              {data.map((record, index) => {
                const fields = record.fields || {};
                const activityName = fields['Activity'] || fields['Name'] || fields['Task'] || `Activity ${index + 1}`;
                const startMonth = fields['Start Month'] || fields['Start'] || 1;
                const endMonth = fields['End Month'] || fields['End'] || 1;
                const priority = fields['Priority'] || fields['Category'] || 'General';

                return (
                  <div key={record.id || index} className="flex items-center border-b border-gray-100 hover:bg-gray-50">
                    <div className="w-80 flex-shrink-0 p-3 text-sm">
                      <div className="font-medium">{activityName}</div>
                      <div className="text-xs text-gray-500">{priority}</div>
                    </div>
                    <div className="flex-1 relative h-12">
                      <div className="absolute inset-0 flex items-center">
                        <div 
                          className="h-6 bg-blue-500 rounded opacity-75 flex items-center justify-center text-white text-xs"
                          style={{
                            left: `${getMonthPosition(startMonth - 1)}%`,
                            width: `${getTaskWidth(startMonth - 1, endMonth - 1)}%`,
                            minWidth: '20px'
                          }}
                        >
                          {startMonth === endMonth ? `M${startMonth}` : `M${startMonth}-M${endMonth}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {data.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No activities found in your Airtable data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
