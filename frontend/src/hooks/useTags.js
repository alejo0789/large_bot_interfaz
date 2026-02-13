import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

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

            const response = await fetch(`${API_URL}/api/tags`);
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
            const response = await fetch(`${API_URL}/api/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    // Get tags for a specific conversation
    const getConversationTags = useCallback(async (phone) => {
        try {
            const response = await fetch(`${API_URL}/api/conversations/${phone}/tags`);
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
            const response = await fetch(`${API_URL}/api/conversations/${phone}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const response = await fetch(`${API_URL}/api/conversations/${phone}/tags/${tagId}`, {
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
        getConversationTags,
        assignTag,
        removeTag
    };
};

export default useTags;
