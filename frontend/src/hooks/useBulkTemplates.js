import { useState, useEffect, useCallback } from 'react';
import apiFetch from '../utils/api';

export const useBulkTemplates = () => {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);


    const fetchTemplates = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/api/bulk-templates');
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
            const res = await apiFetch('/api/bulk-templates', {
                method: 'POST',
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
            const res = await apiFetch(`/api/bulk-templates/${id}`, {
                method: 'PUT',
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
            const res = await apiFetch(`/api/bulk-templates/${id}`, {
                method: 'DELETE'
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
