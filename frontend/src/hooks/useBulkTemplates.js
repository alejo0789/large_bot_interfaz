import { useState, useEffect, useCallback } from 'react';

// Use same config import if possible, or relative constant
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const useBulkTemplates = () => {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'x-api-key': process.env.REACT_APP_API_KEY || ''
    });

    const fetchTemplates = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/bulk-templates`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Error al cargar plantillas');
            const data = await res.json();
            if (data.success) {
                setTemplates(data.data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createTemplate = async (name, content) => {
        try {
            const res = await fetch(`${API_URL}/api/bulk-templates`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name, content })
            });
            if (!res.ok) throw new Error('Error al crear plantilla');
            const data = await res.json();
            if (data.success) {
                setTemplates(prev => [data.data, ...prev]);
                return data.data;
            }
        } catch (err) {
            throw err;
        }
    };

    const updateTemplate = async (id, name, content) => {
        try {
            const res = await fetch(`${API_URL}/api/bulk-templates/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name, content })
            });
            if (!res.ok) throw new Error('Error al actualizar plantilla');
            const data = await res.json();
            if (data.success) {
                setTemplates(prev => prev.map(t => t.id === id ? data.data : t));
                return data.data;
            }
        } catch (err) {
            throw err;
        }
    };

    const deleteTemplate = async (id) => {
        try {
            const res = await fetch(`${API_URL}/api/bulk-templates/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Error al eliminar plantilla');
            const data = await res.json();
            if (data.success) {
                setTemplates(prev => prev.filter(t => t.id !== id));
            }
        } catch (err) {
            throw err;
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    return {
        templates,
        isLoading,
        error,
        fetchTemplates,
        createTemplate,
        updateTemplate,
        deleteTemplate
    };
};
