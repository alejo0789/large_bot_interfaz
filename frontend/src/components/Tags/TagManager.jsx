import React, { useState } from 'react';
import { Plus, X, Tag } from 'lucide-react';
import TagBadge from './TagBadge';

const TAG_COLORS = [
    { name: 'Rojo', value: '#EF4444' },
    { name: 'Naranja', value: '#F97316' },
    { name: 'Amarillo', value: '#EAB308' },
    { name: 'Verde', value: '#22C55E' },
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Morado', value: '#8B5CF6' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Gris', value: '#6B7280' },
];

/**
 * Tag manager modal component
 */
const TagManager = ({
    isOpen,
    onClose,
    tags,
    conversationPhone,
    conversationTags = [],
    onCreateTag,
    onAssignTag,
    onRemoveTag
}) => {
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value);
    const [isCreating, setIsCreating] = useState(false);

    if (!isOpen) return null;

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;

        try {
            await onCreateTag(newTagName.trim(), newTagColor);
            setNewTagName('');
            setIsCreating(false);
        } catch (error) {
            console.error('Error creating tag:', error);
        }
    };

    const handleAssignTag = async (tagId) => {
        try {
            await onAssignTag(conversationPhone, tagId);
        } catch (error) {
            console.error('Error assigning tag:', error);
        }
    };

    const handleRemoveTag = async (tagId) => {
        try {
            await onRemoveTag(conversationPhone, tagId);
        } catch (error) {
            console.error('Error removing tag:', error);
        }
    };

    const assignedTagIds = conversationTags.map(t => t.id);
    const availableTags = tags.filter(t => !assignedTagIds.includes(t.id));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        <Tag className="w-5 h-5" style={{ marginRight: 'var(--space-2)', display: 'inline' }} />
                        Gestionar Etiquetas
                    </h3>
                    <button className="btn btn-icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Assigned tags */}
                    {conversationTags.length > 0 && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h4 style={{
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 600,
                                marginBottom: 'var(--space-2)',
                                color: 'var(--color-gray-700)'
                            }}>
                                Etiquetas asignadas
                            </h4>
                            <div className="tags-container">
                                {conversationTags.map(tag => (
                                    <TagBadge
                                        key={tag.id}
                                        tag={tag}
                                        onRemove={() => handleRemoveTag(tag.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Available tags */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-gray-700)'
                        }}>
                            Etiquetas disponibles
                        </h4>
                        {availableTags.length > 0 ? (
                            <div className="tags-container">
                                {availableTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => handleAssignTag(tag.id)}
                                        className="tag"
                                        style={{
                                            backgroundColor: tag.color,
                                            color: '#fff',
                                            cursor: 'pointer',
                                            border: 'none'
                                        }}
                                    >
                                        <Plus className="w-3 h-3" />
                                        {tag.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-gray-500)'
                            }}>
                                Todas las etiquetas están asignadas
                            </p>
                        )}
                    </div>

                    {/* Create new tag */}
                    <div>
                        <h4 style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-gray-700)'
                        }}>
                            Crear nueva etiqueta
                        </h4>

                        {isCreating ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Nombre de la etiqueta"
                                    value={newTagName}
                                    onChange={(e) => setNewTagName(e.target.value)}
                                    style={{ paddingLeft: 'var(--space-3)' }}
                                    autoFocus
                                />

                                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                    {TAG_COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => setNewTagColor(color.value)}
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: 'var(--radius-full)',
                                                backgroundColor: color.value,
                                                border: newTagColor === color.value
                                                    ? '3px solid var(--color-gray-900)'
                                                    : '2px solid transparent',
                                                cursor: 'pointer'
                                            }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                                    <button
                                        className="btn"
                                        onClick={() => setIsCreating(false)}
                                        style={{ backgroundColor: 'var(--color-gray-200)', color: 'var(--color-gray-700)' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleCreateTag}
                                        disabled={!newTagName.trim()}
                                    >
                                        Crear
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                className="btn"
                                onClick={() => setIsCreating(true)}
                                style={{
                                    width: '100%',
                                    backgroundColor: 'var(--color-gray-100)',
                                    color: 'var(--color-gray-700)'
                                }}
                            >
                                <Plus className="w-4 h-4" />
                                Nueva etiqueta
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TagManager;
