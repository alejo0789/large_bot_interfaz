import { useState, useCallback, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const useQuickReplies = () => {
    const [quickReplies, setQuickReplies] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchQuickReplies = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/quick-replies`);
            if (!response.ok) throw new Error('Error fetching quick replies');
            const data = await response.json();
            setQuickReplies(data);
        } catch (err) {
            console.error('Error loading quick replies:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createQuickReply = useCallback(async (data) => {
        try {
            const response = await fetch(`${API_URL}/api/quick-replies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error creating quick reply');
            }

            await fetchQuickReplies();
            return true;
        } catch (err) {
            console.error('Error creating quick reply:', err);
            throw err;
        }
    }, [fetchQuickReplies]);

    const updateQuickReply = useCallback(async (id, data) => {
        try {
            const response = await fetch(`${API_URL}/api/quick-replies/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error updating quick reply');
            }

            await fetchQuickReplies();
            return await response.json();
        } catch (err) {
            console.error('Error updating quick reply:', err);
            throw err;
        }
    }, [fetchQuickReplies]);

    const uploadQuickReplyMedia = useCallback(async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/api/quick-replies/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error uploading media');
            }

            return await response.json();
        } catch (err) {
            console.error('Error uploading quick reply media:', err);
            throw err;
        }
    }, []);

    const deleteQuickReply = useCallback(async (id) => {
        try {
            const response = await fetch(`${API_URL}/api/quick-replies/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Error deleting quick reply');

            setQuickReplies(prev => prev.filter(qr => qr.id !== id));
            return true;
        } catch (err) {
            console.error('Error deleting quick reply:', err);
            throw err;
        }
    }, []);

    // Load on mount
    useEffect(() => {
        fetchQuickReplies();
    }, [fetchQuickReplies]);

    return {
        quickReplies,
        isLoading,
        error,
        fetchQuickReplies,
        createQuickReply,
        updateQuickReply,
        deleteQuickReply,
        uploadQuickReplyMedia
    };
};
