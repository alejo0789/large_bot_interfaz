import React, { useMemo } from 'react';
import ConversationItem from './ConversationItem';

/**
 * Conversation list component
 */
const ConversationList = ({
    conversations,
    selectedId,
    searchQuery,
    aiStatesByPhone,
    tagsByPhone = {},
    isLoading,
    onSelect,
    onTagClick
}) => {
    // ... (rest of logic) ...

    return (
        <div className="conversation-list">
            {filteredConversations.map(conversation => (
                <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedId === conversation.id}
                    aiEnabled={aiStatesByPhone[conversation.contact.phone] ?? true}
                    tags={tagsByPhone[conversation.contact.phone] || []}
                    onClick={() => onSelect(conversation)}
                    onTagClick={onTagClick}
                />
            ))}
        </div>
    );
};

export default ConversationList;
