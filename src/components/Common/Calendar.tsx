import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateToLocalString, isSameDay } from '../../lib/dateUtils';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasData: boolean;
  dataCount?: number;
}

interface CalendarProps {
  dataByDate: Record<string, number>; // Format: "YYYY-MM-DD": count
  onDateClick?: (date: Date) => void;
  className?: string;
}

export const Calendar: React.FC<CalendarProps> = ({ 
  dataByDate, 
  onDateClick, 
  className = '' 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  useEffect(() => {
    generateCalendarDays();
  }, [currentDate, dataByDate]);

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Premier jour du mois
    const firstDay = new Date(year, month, 1);
    // Dernier jour du mois
    const lastDay = new Date(year, month + 1, 0);
    
    // Premier jour de la semaine du premier jour du mois
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Dernier jour de la semaine du dernier jour du mois
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = formatDateToLocalString(date);
      const hasData = dataByDate[dateStr] > 0;
      const dataCount = dataByDate[dateStr] || 0;
      
      days.push({
        date: new Date(date),
        isCurrentMonth: date.getMonth() === month,
        isToday: isSameDay(date, today),
        hasData,
        dataCount
      });
    }
    
    setCalendarDays(days);
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (day: CalendarDay) => {
    if (onDateClick) {
      onDateClick(day.date);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      {/* En-tête du calendrier */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            Aujourd'hui
          </button>
        </div>
        
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Grille du calendrier */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => (
          <button
            key={index}
            onClick={() => handleDateClick(day)}
            className={`
              relative p-2 text-sm rounded-md transition-colors
              ${!day.isCurrentMonth 
                ? 'text-gray-300 hover:bg-gray-50' 
                : day.isToday
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : day.hasData
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'text-gray-700 hover:bg-gray-100'
              }
              ${onDateClick ? 'cursor-pointer' : 'cursor-default'}
            `}
          >
            <span className="block">{day.date.getDate()}</span>
            {day.hasData && day.dataCount && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {day.dataCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Légende */}
      <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-500">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-green-100 rounded"></div>
          <span>Ventes</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span>Aujourd'hui</span>
        </div>
      </div>
    </div>
  );
};
