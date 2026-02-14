


import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function CustomSelect({ label, value, onChange, options = [], placeholder = "Pilih...", required = false, disabled = false, optionAlign = "left", textSize = "text-sm", isMulti = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);
    const [dropdownStyles, setDropdownStyles] = useState({});

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                // Also check if click is inside the portal dropdown (not easy here without ref to portal, but manageable)
                // Actually, if we use a separate ref for portal content, we can check.
                // But simplified: clicking outside container closes it.
                // If clicking inside portal, event.target won't be in containerRef (it's in body).
                // So we need to handle "click inside portal" not closing it.
                // The portal content should modify the close behavior.
                // Let's rely on the portal content's stopPropagation or check if target is in portal.
                // Implementation below adds a dataset attribute or class to identify portal clicks?
                // Or easier: Add a backdrop to the portal? No, that blocks other interactions.
                // Best way: check if target is inside the dropdown element (ref).
            }
        }
        // We will handle close logic differently for Portal:
        // We add a global click listener that closes IF not inside container AND not inside dropdown.
    }, []);

    // Calculate position on open
    useEffect(() => {
        if (isOpen && containerRef.current) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition);
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }, [isOpen]);

    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceNeeded = 250; // Approximating max-height of 15rem + padding

            let top, bottom;
            if (spaceBelow < spaceNeeded && rect.top > spaceNeeded) {
                // Flip upwards
                top = 'auto';
                bottom = `${window.innerHeight - rect.top + 4}px`;
            } else {
                // Default downwards
                top = `${rect.bottom + 4}px`;
                bottom = 'auto';
            }

            setDropdownStyles({
                position: 'fixed',
                top,
                bottom,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                zIndex: 9999,
                maxHeight: '15rem'
            });
        }
    };

    // Focus search input when opened and reset search when closed
    useEffect(() => {
        if (isOpen) {
            // Wait for render
            setTimeout(() => {
                if (searchInputRef.current) searchInputRef.current.focus();
            }, 50);
        } else {
            const timer = setTimeout(() => setSearchTerm(''), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Global Click Listener to Close
    useEffect(() => {
        if (!isOpen) return;

        const handleClick = (e) => {
            // Check if click is inside container (Button)
            const inContainer = containerRef.current && containerRef.current.contains(e.target);
            // Check if click is inside dropdown (Portal) - we need a ref for the dropdown content
            // We can add a specialized class or ID to the dropdown to check
            const inDropdown = e.target.closest('.custom-select-dropdown');

            if (!inContainer && !inDropdown) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClick); // mousedown catches before click
        // Also touchstart for mobile?
        document.addEventListener('touchstart', handleClick);

        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('touchstart', handleClick);
        };
    }, [isOpen]);


    // Helper for Multi Select
    const handleMultiSelect = (optionValue) => {
        let newValue;
        if (value.includes(optionValue)) {
            newValue = value.filter(v => v !== optionValue);
        } else {
            newValue = [...value, optionValue];
        }
        onChange(newValue);
        // Do not close on multi select
    };

    const handleSingleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    // Display Logic
    let displayValue = placeholder;
    if (isMulti) {
        if (value && value.length > 0) {
            if (value.length === 1) {
                const found = options.find(opt => opt.value === value[0]);
                displayValue = found ? found.label : placeholder;
            } else {
                displayValue = `${value.length} opsi dipilih`;
            }
        }
    } else {
        const selectedOption = options.find(opt => opt.value === value);
        if (selectedOption) displayValue = selectedOption.label;
    }


    // Filter and Sort options
    const filteredOptions = options
        .filter(opt =>
            opt.label.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) =>
            a.label.toString().localeCompare(b.label.toString())
        );

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-sm text-gray-400 mb-1">{label} {required && '*'}</label>}

            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border flex justify-between items-center transition-colors
                    ${disabled ? 'opacity-50 cursor-not-allowed border-white/5' : 'hover:bg-white/10 cursor-pointer'}
                    ${isOpen ? 'border-purple-500 ring-1 ring-purple-500' : 'border-purple-500/30'}
                    ${optionAlign === 'center' ? 'text-center' : 'text-left'}
                `}
            >
                <div className={`flex-1 truncate ${(!isMulti && !value) || (isMulti && value.length === 0) ? 'text-gray-500' : 'text-white'} ${optionAlign === 'center' ? 'text-center' : 'text-left'}`}>
                    {displayValue}
                </div>
                <svg
                    className={`w-4 h-4 text-gray-400 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && createPortal(
                <div
                    className="custom-select-dropdown bg-[#1f2937] border border-purple-500/30 rounded-lg shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
                    style={dropdownStyles}
                >

                    {/* Search Input Sticky Header */}
                    <div className="p-2 border-b border-white/10 bg-[#1f2937]/95 backdrop-blur-sm sticky top-0 z-10">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm rounded bg-white/10 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                            placeholder="🔍 Cari..."
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
                        />
                    </div>

                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center italic">
                                {searchTerm ? 'Tidak ditemukan' : 'Tidak ada opsi'}
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = isMulti ? value.includes(opt.value) : value === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => isMulti ? handleMultiSelect(opt.value) : handleSingleSelect(opt.value)}
                                        className={`w-full px-4 py-2 ${textSize} transition-colors flex items-center 
                                        ${optionAlign === 'center' ? 'justify-center' : 'justify-between text-left'}
                                        ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'text-gray-300 hover:bg-white/5 hover:text-white'}
                                    `}
                                    >
                                        <span className="flex-1">{opt.label}</span>
                                        {isSelected && optionAlign !== 'center' && (
                                            <span className="ml-2">✓</span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
