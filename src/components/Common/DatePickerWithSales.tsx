import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDateToLocalString, createDateFromLocalString, isSameDay, formatDateDisplay } from '../../lib/dateUtils';

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

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

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

  const formatDisplayDate = (date: Date) => formatDateDisplay(date);

  const calendarDays = generateCalendarDays();

  return (
    <div className={`relative ${className}`} ref={datePickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="app-input text-xs py-1.5 w-auto min-w-[9.5rem] flex items-center justify-between gap-2 cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className={selectedDate ? 'app-text' : 'app-text-muted'}>
          {selectedDate ? formatDisplayDate(selectedDate) : placeholder}
        </span>
        <Calendar className="h-3.5 w-3.5 app-text-muted flex-shrink-0" />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 z-50 min-w-[280px] app-surface shadow-[var(--app-shadow-panel)]"
          role="dialog"
          aria-label="Calendrier des ventes"
        >
          <div className="flex items-center justify-between p-2.5 border-b app-divider">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-1 rounded-md app-text-muted hover:bg-[var(--app-surface-muted)] hover:app-text"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <h3 className="text-xs font-semibold app-text">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>

            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 rounded-md app-text-muted hover:bg-[var(--app-surface-muted)] hover:app-text"
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 p-2">
            {dayNames.map((day) => (
              <div key={day} className="p-1.5 text-center text-[11px] font-medium app-text-muted">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 p-2 pt-0">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleDateClick(day.date)}
                className={`
                  relative p-1.5 text-xs rounded-md transition-colors
                  ${!day.isCurrentMonth
                    ? 'app-text-muted opacity-40 hover:bg-[var(--app-surface-muted)]'
                    : day.isSelected
                      ? 'bg-[var(--app-primary)] text-[var(--app-surface)] hover:bg-[var(--app-primary-deep)]'
                      : day.isToday
                        ? 'bg-[var(--app-primary-soft)] app-text-link'
                        : day.hasSales
                          ? 'bg-[color-mix(in_srgb,var(--app-success)_14%,transparent)] app-text-success hover:bg-[color-mix(in_srgb,var(--app-success)_22%,transparent)]'
                          : 'app-text hover:bg-[var(--app-surface-muted)]'
                  }
                `}
              >
                <span className="block">{day.date.getDate()}</span>
                {day.hasSales && day.salesCount ? (
                  <span className="absolute -top-0.5 -right-0.5 bg-[var(--app-success)] text-[var(--app-surface)] text-[10px] rounded-full h-3.5 w-3.5 flex items-center justify-center leading-none">
                    {day.salesCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 p-2 border-t app-divider">
            <button
              type="button"
              onClick={clearDate}
              className="app-btn app-btn-ghost app-btn-sm"
            >
              <X className="h-3 w-3" />
              Effacer
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="app-btn app-btn-secondary app-btn-sm"
            >
              Aujourd'hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
