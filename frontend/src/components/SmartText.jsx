import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const SmartText = ({ children, className = '', maxLength = null }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState(null);
    const [placement, setPlacement] = useState('top'); // 'top' or 'bottom'
    const elementRef = useRef(null);

    // Close tooltip on click outside or scroll
    useLayoutEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => setIsOpen(false), 5000); // Auto close after 5s

        const handleInteraction = (e) => {
            // Close if clicking outside
            if (elementRef.current && !elementRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => setIsOpen(false);

        // Use capture for scroll to detect scrolling in parents
        window.addEventListener('mousedown', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('mousedown', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    const handleClick = (e) => {
        e.stopPropagation();

        if (isOpen) {
            setIsOpen(false);
            return;
        }

        // Calculate position before showing
        if (elementRef.current) {
            const rect = elementRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Check if space above is too small (< 40px)
            // If sticking to top, move to bottom
            let newPlacement = 'top';
            if (rect.top < 50) {
                newPlacement = 'bottom';
            }

            setPlacement(newPlacement);

            setCoords({
                rect,
                centerX: rect.left + rect.width / 2
            });
            setIsOpen(true);
        }
    };

    // Determine content to show
    let content = children;
    if (maxLength && typeof children === 'string' && children.length > maxLength) {
        content = children.substring(0, maxLength) + '...';
    }

    return (
        <>
            <div
                ref={elementRef}
                onClick={handleClick}
                className={`truncate ${className} cursor-pointer active:opacity-70 transition-opacity`}
                title={!isOpen ? (typeof children === 'string' ? children : '') : ''} // Fallback title if not open
            >
                {content}
            </div>

            {/* Portal for Tooltip */}
            {isOpen && coords && createPortal(
                <div
                    className="fixed z-[99999] pointer-events-none"
                    style={{
                        top: placement === 'top' ? coords.rect.top : coords.rect.bottom,
                        left: coords.centerX,
                        transform: 'translate(-50%, 0)'
                    }}
                >
                    <div
                        className={`
                            relative bg-slate-900 text-white text-xs px-2 py-1.5 rounded shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 duration-150
                            ${placement === 'top' ? '-translate-y-full mb-2' : 'mt-2'}
                        `}
                    >
                        {children}

                        {/* Arrow */}
                        <div
                            className={`
                                absolute left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent
                                ${placement === 'top'
                                    ? 'top-full border-t-slate-900'
                                    : 'bottom-full border-b-slate-900'
                                }
                            `}
                        ></div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default SmartText;
