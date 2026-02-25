import React from 'react';
import { Tag, Trash2, MessageSquare, X, CheckSquare } from 'lucide-react';

/**
 * Compact pill-style bar for bulk actions on selected conversations
 */
const BulkActionsBar = ({
    selectedCount,
    onClear,
    onDelete,
    onTag,
    onMessage,
    onSelectAll
}) => {
    if (selectedCount === 0) return null;

    return (
        <div className="bulk-actions-pill animate-slide-up">
            <div className="pill-content">
                <div className="pill-info">
                    <button className="pill-close" onClick={onClear} title="Cancelar selección">
                        <X size={16} />
                    </button>
                    <div className="pill-count-badge">
                        {selectedCount}
                    </div>
                </div>

                <div className="pill-divider" />

                <div className="pill-actions">
                    <button className="pill-btn" onClick={onSelectAll} title="Seleccionar todos">
                        <CheckSquare size={20} />
                    </button>

                    <button className="pill-btn primary" onClick={onMessage} title="Mensaje masivo">
                        <MessageSquare size={20} />
                    </button>

                    <button className="pill-btn" onClick={onTag} title="Etiquetar seleccionados">
                        <Tag size={20} />
                    </button>

                    <button className="pill-btn danger" onClick={onDelete} title="Eliminar seleccionados">
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <style jsx>{`
                .bulk-actions-pill {
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 100;
                    background: var(--color-surface);
                    color: var(--color-text);
                    border-radius: 30px;
                    padding: 6px;
                    box-shadow: var(--shadow-xl);
                    border: 1px solid var(--color-border);
                    backdrop-filter: blur(10px);
                    width: auto;
                    min-width: 240px;
                    pointer-events: auto;
                }

                .pill-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }

                .pill-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding-left: 8px;
                }

                .pill-close {
                    background: none;
                    border: none;
                    color: var(--color-gray-400);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .pill-close:hover {
                    background: var(--color-gray-100);
                    color: var(--color-danger);
                }

                .pill-count-badge {
                    background: var(--color-primary);
                    color: white;
                    font-size: 12px;
                    font-weight: 700;
                    min-width: 20px;
                    height: 20px;
                    padding: 0 6px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .pill-divider {
                    width: 1px;
                    height: 24px;
                    background: var(--color-border);
                    margin: 0 4px;
                }

                .pill-actions {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding-right: 4px;
                }

                .pill-btn {
                    background: none;
                    border: none;
                    color: var(--color-gray-600);
                    cursor: pointer;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .pill-btn:hover {
                    background: var(--color-gray-100);
                    color: var(--color-text);
                    transform: translateY(-2px);
                }

                .pill-btn.primary {
                    color: var(--color-primary);
                }

                .pill-btn.danger {
                    color: var(--color-danger);
                }

                @keyframes pill-slide-up {
                    from { transform: translate(-50%, 20px) scale(0.9); opacity: 0; }
                    to { transform: translate(-50%, 0) scale(1); opacity: 1; }
                }

                .animate-slide-up {
                    animation: pill-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @media (max-width: 768px) {
                    .bulk-actions-pill {
                        position: fixed;
                        bottom: 80px;
                        min-width: 260px;
                    }
                }
            `}</style>
        </div>
    );
};

export default BulkActionsBar;
