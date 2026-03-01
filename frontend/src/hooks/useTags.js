import { useState, useEffect, useCallback } from 'react';
import apiFetch from '../utils/api';

/**
 * Custom hook for managing tags
 * @returns {Object} Tag state and handlers
 */
export const useTags = () => {
    const [tags, setTags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch all available tags
    const fetchTags = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await apiFetch('/api/tags');
            if (!response.ok) throw new Error('Error fetching tags');

            const data = await response.json();
            setTags(data);
        } catch (err) {
            console.error('Error fetching tags:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Create a new tag
    const createTag = useCallback(async (name, color) => {
        try {
            const response = await apiFetch('/api/tags', {
                method: 'POST',
                body: JSON.stringify({ name, color })
            });

            if (!response.ok) throw new Error('Error creating tag');

            const newTag = await response.json();
            setTags(prev => [...prev, newTag]);
            return newTag;
        } catch (err) {
            console.error('Error creating tag:', err);
            throw err;
        }
    }, []);

    // Update an existing tag
    const updateTag = useCallback(async (tagId, name, color) => {
        try {
            const response = await apiFetch(`/api/tags/${tagId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, color })
            });

            if (!response.ok) throw new Error('Error updating tag');

            const updatedTag = await response.json();
            setTags(prev => prev.map(t => t.id === tagId ? updatedTag : t));
            return updatedTag;
        } catch (err) {
            console.error('Error updating tag:', err);
            throw err;
        }
    }, []);

    // Get tags for a specific conversation
    const getConversationTags = useCallback(async (phone) => {
        try {
            const response = await apiFetch(`/api/conversations/${phone}/tags`);
            if (!response.ok) throw new Error('Error fetching conversation tags');
            return await response.json();
        } catch (err) {
            console.error('Error fetching conversation tags:', err);
            return [];
        }
    }, []);

    // Assign tag to conversation
    const assignTag = useCallback(async (phone, tagId) => {
        try {
            const response = await apiFetch(`/api/conversations/${phone}/tags`, {
                method: 'POST',
                body: JSON.stringify({ tagId })
            });

            if (!response.ok) throw new Error('Error assigning tag');
            return await response.json();
        } catch (err) {
            console.error('Error assigning tag:', err);
            throw err;
        }
    }, []);

    // Remove tag from conversation
    const removeTag = useCallback(async (phone, tagId) => {
        try {
            const response = await apiFetch(`/api/conversations/${phone}/tags/${tagId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Error removing tag');
            return await response.json();
        } catch (err) {
            console.error('Error removing tag:', err);
            throw err;
        }
    }, []);

    // Fetch tags on mount
    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    return {
        tags,
        isLoading,
        error,
        fetchTags,
        createTag,
        updateTag,
        getConversationTags,
        assignTag,
        removeTag
    };
};

export default useTags;
