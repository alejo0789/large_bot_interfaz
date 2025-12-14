import React from 'react';
import { Search } from 'lucide-react';

/**
 * Search bar component for conversations
 */
const SearchBar = ({ value, onChange, placeholder = 'Buscar conversaciones...' }) => {
    return (
        <div className="sidebar-search">
            <div style={{ position: 'relative' }}>
                <Search
                    className="w-4 h-4"
                    style={{
                        position: 'absolute',
                        left: 'var(--space-3)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-gray-400)'
                    }}
                />
                <input
                    type="text"
                    className="search-input"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        </div>
    );
};

export default SearchBar;
