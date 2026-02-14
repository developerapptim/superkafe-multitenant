import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function CalendarInput({ label, value, onChange, minDate, maxDate, placeholder = "Pilih Tanggal", required = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date()); // Current month view
    const containerRef = useRef(null);

    // Initialize viewDate from value or minDate
    useEffect(() => {
        if (value) {
            setViewDate(new Date(value));
        } else if (minDate) {
            setViewDate(new Date(minDate));
        }
    }, [value, isOpen]); // Reset when opening if needed

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            // Check if click is inside the container input OR inside the portal modal
            const isInsideContainer = containerRef.current && containerRef.current.contains(event.target);
            const isInsidePortal = event.target.closest('.calendar-portal-content');

            if (!isInsideContainer && !isInsidePortal) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Calendar Logic
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

    const prevMonth = () => {
        setViewDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const nextMonth = () => {
        setViewDate(new Date(currentYear, currentMonth + 1, 1));
    };

    const handleDateClick = (day) => {
        // Construct YYYY-MM-DD in local time
        const selected = new Date(currentYear, currentMonth, day);
        // Manual formatting to avoid timezone shifts
        const year = selected.getFullYear();
        const month = String(selected.getMonth() + 1).padStart(2, '0');
        const d = String(selected.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${d}`;

        onChange(dateStr);
        setIsOpen(false);
    };

    const isDateDisabled = (day) => {
        const dateToCheck = new Date(currentYear, currentMonth, day, 23, 59, 59); // End of that day
        const dateToCheckStart = new Date(currentYear, currentMonth, day, 0, 0, 0);

        if (minDate) {
            // Parse YYYY-MM-DD manually to avoid UTC shifts
            const [y, m, d] = minDate.split('-').map(Number);
            const min = new Date(y, m - 1, d, 0, 0, 0); // Local midnight
            if (dateToCheckStart < min) return true;
        }
        if (maxDate) {
            const [y, m, d] = maxDate.split('-').map(Number);
            const max = new Date(y, m - 1, d, 23, 59, 59, 999); // Local end of day
            if (dateToCheck > max) return true;
        }
        return false;
    };

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return placeholder;
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Generate grid days
    const renderDays = () => {
        const days = [];
        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }
        // Actual days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = value === dateStr;
            const disabled = isDateDisabled(d);

            days.push(
                <button
                    key={d}
                    type="button"
                    onClick={(e) => {
                        !disabled && handleDateClick(d)
                    }}
                    disabled={disabled}
                    className={`
                        w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all mx-auto
                        ${isSelected
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 scale-110'
                            : disabled
                                ? 'text-gray-600 cursor-not-allowed opacity-50'
                                : 'text-gray-200 hover:bg-white/10 hover:text-white'
                        }
                    `}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-sm text-gray-400 mb-1">{label} {required && '*'}</label>}

            {/* Input Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full px-4 py-3 rounded-xl bg-white/5 border text-left flex justify-between items-center transition-colors
                    ${isOpen ? 'border-purple-500 ring-1 ring-purple-500' : 'border-purple-500/30'}
                    ${value ? 'text-white' : 'text-gray-500'}
                    hover:bg-white/10
                `}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <span>📅</span>
                    <span className="truncate">{formatDateDisplay(value)}</span>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Calendar Popover / Modal */}
            {isOpen && (
                <>
                    {/* Mobile Modal (Portal) */}
                    {createPortal(
                        <div
                            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm md:hidden"
                            onClick={() => setIsOpen(false)}
                        >
                            <div
                                className="calendar-portal-content w-full max-w-sm bg-[#1f2937] border border-purple-500/30 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 backdrop-blur-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <button type="button" onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                    </button>
                                    <span className="font-bold text-white text-lg">
                                        {monthNames[currentMonth]} {currentYear}
                                    </span>
                                    <button type="button" onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>

                                {/* Weekdays */}
                                <div className="grid grid-cols-7 mb-2 text-center">
                                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                                        <div key={d} className="text-xs font-semibold text-gray-500">{d}</div>
                                    ))}
                                </div>

                                {/* Days Grid */}
                                <div className="grid grid-cols-7 gap-y-1">
                                    {renderDays()}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* Desktop Popover (Absolute) */}
                    <div className="hidden md:block absolute z-[60] mt-2 min-w-[300px] bg-[#1f2937] border border-purple-500/30 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 backdrop-blur-xl left-0">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <button type="button" onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <span className="font-bold text-white text-lg">
                                {monthNames[currentMonth]} {currentYear}
                            </span>
                            <button type="button" onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>

                        {/* Weekdays */}
                        <div className="grid grid-cols-7 mb-2 text-center">
                            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                                <div key={d} className="text-xs font-semibold text-gray-500">{d}</div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-y-1">
                            {renderDays()}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
