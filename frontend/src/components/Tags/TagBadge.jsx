import React from 'react';
import { X } from 'lucide-react';

/**
 * Tag badge component
 */
const TagBadge = ({ tag, onRemove, size = 'normal' }) => {
    const sizeClass = size === 'small' ? 'tag-small' : '';

    return (
        <span
            className={`tag ${sizeClass}`}
            style={{
                backgroundColor: tag.color || 'var(--tag-gray)',
                color: '#fff'
            }}
        >
            {tag.name}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(tag.id);
                    }}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        marginLeft: 'var(--space-1)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    <X className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.8)' }} />
                </button>
            )}
        </span>
    );
};

export default TagBadge;
