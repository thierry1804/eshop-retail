import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDateToLocalString, createDateFromLocalString, isSameDay } from '../../lib/dateUtils';

interface DatePickerWithSalesProps {
  value: string; // Format YYYY-MM-DD
  onChange: (date: string) => void;
  salesByDate: Record<string, number>; // Format: "YYYY-MM-DD": count
  placeholder?: string;
  className?: string;
}

export const DatePickerWithSales: React.FC<DatePickerWithSalesProps> = ({
  value,
  onChange,
  salesByDate,
  placeholder = "Sélectionner une date",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? createDateFromLocalString(value) : null
  );
  const datePickerRef = useRef<HTMLDivElement>(null);

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  useEffect(() => {
    if (value) {
      setSelectedDate(createDateFromLocalString(value));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    
    const days = [];
    const today = new Date();
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = formatDateToLocalString(date);
      const hasSales = salesByDate[dateStr] > 0;
      const salesCount = salesByDate[dateStr] || 0;
      
      days.push({
        date: new Date(date),
        isCurrentMonth: date.getMonth() === month,
        isToday: isSameDay(date, today),
        isSelected: selectedDate && isSameDay(date, selectedDate),
        hasSales,
        salesCount
      });
    }
    
    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    onChange(formatDateToLocalString(today));
    setIsOpen(false);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onChange(formatDateToLocalString(date));
    setIsOpen(false);
  };

  const clearDate = () => {
    setSelectedDate(null);
    onChange('');
    setIsOpen(false);
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR');
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className={`relative ${className}`} ref={datePickerRef}>
      {/* Input field */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span className={selectedDate ? 'text-gray-900' : 'text-gray-500'}>
          {selectedDate ? formatDisplayDate(selectedDate) : placeholder}
        </span>
        <Calendar className="h-5 w-5 text-gray-400" />
      </div>

      {/* Dropdown calendar */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200">
            <button
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <h3 className="text-sm font-semibold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            
            <button
              onClick={goToNextMonth}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 gap-1 p-2">
            {dayNames.map((day) => (
              <div key={day} className="p-2 text-center text-xs font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 p-2">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                onClick={() => handleDateClick(day.date)}
                className={`
                  relative p-2 text-xs rounded-md transition-colors
                  ${!day.isCurrentMonth 
                    ? 'text-gray-300 hover:bg-gray-50' 
                    : day.isSelected
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : day.isToday
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        : day.hasSales
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <span className="block">{day.date.getDate()}</span>
                {day.hasSales && day.salesCount && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {day.salesCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-2 border-t border-gray-200">
            <button
              onClick={clearDate}
              className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-3 w-3" />
              <span>Effacer</span>
            </button>
            <button
              onClick={goToToday}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              Aujourd'hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
