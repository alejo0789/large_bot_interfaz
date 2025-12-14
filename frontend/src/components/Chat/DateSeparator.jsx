import React from 'react';

/**
 * Date separator component for grouping messages by date
 */
const DateSeparator = ({ label }) => {
    return (
        <div className="date-separator">
            <span className="date-separator-text">{label}</span>
        </div>
    );
};

export default DateSeparator;
