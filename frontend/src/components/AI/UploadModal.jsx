import React, { useState } from 'react';
import { X, Upload, File as FileIcon } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const UploadModal = ({ isOpen, onClose, type, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [description, setDescription] = useState('');
    const [keywords, setKeywords] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            // Validar tipo si es necesario
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setError('Por favor selecciona un archivo');
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', description);
        formData.append('keywords', keywords); // Backend espera string separado por comas o array

        try {
            const response = await fetch(`${API_URL}/api/ai-knowledge/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error subiendo archivo');
            }

            const newResource = await response.json();
            onSuccess(newResource);
            onClose();
            // Reset form
            setFile(null);
            setDescription('');
            setKeywords('');
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ padding: '24px' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer' }}
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px' }}>
                    Subir {type === 'image' ? 'Imagen' : 'Archivo Multimedia'}
                </h3>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* File Input */}
                    <div style={{
                        border: '2px dashed #e5e7eb',
                        borderRadius: '8px',
                        padding: '32px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: '#f9fafb'
                    }} onClick={() => document.getElementById('file-upload').click()}>
                        <input
                            id="file-upload"
                            type="file"
                            accept={type === 'image' ? 'image/*' : 'audio/*,video/*'}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        {file ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#4b5563' }}>
                                <FileIcon className="w-5 h-5" />
                                <span>{file.name}</span>
                            </div>
                        ) : (
                            <div style={{ color: '#6b7280' }}>
                                <Upload className="w-8 h-8 mx-auto mb-2" />
                                <p>Haz clic para seleccionar un archivo</p>
                                <p style={{ fontSize: '0.75rem' }}>{type === 'image' ? 'PNG, JPG, GIF' : 'MP3, MP4, WAV'}</p>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Descripción</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe el contenido para la IA..."
                            rows={3}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                        />
                    </div>

                    {/* Keywords */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Palabras clave (separadas por comas)</label>
                        <input
                            type="text"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            placeholder="ej: producto, oferta, nuevo"
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                        />
                    </div>

                    {error && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={uploading}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '6px',
                                backgroundColor: uploading ? '#93c5fd' : '#2563eb',
                                color: 'white',
                                cursor: uploading ? 'default' : 'pointer'
                            }}
                        >
                            {uploading ? 'Subiendo...' : 'Subir'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UploadModal;
