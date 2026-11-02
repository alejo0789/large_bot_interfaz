import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Image as ImageIcon, Loader2, MessageCircle, RefreshCw, Send, X } from 'lucide-react';
import apiFetch from '../../utils/api';

const panelStyle = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 14
};

const InstagramPostsModal = ({ isOpen, onClose, socket }) => {
    const [posts, setPosts] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [expandedCommentId, setExpandedCommentId] = useState(null);

    const loadPosts = useCallback(async () => {
        setIsLoadingPosts(true);
        setError('');
        try {
            const response = await apiFetch('/api/instagram/posts?limit=30');
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las publicaciones.');
            const nextPosts = body.posts || [];
            setPosts(nextPosts);
            setSelectedPost((current) => nextPosts.find((post) => post.id === current?.id) || nextPosts[0] || null);
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setIsLoadingPosts(false);
        }
    }, []);

    const loadComments = useCallback(async (mediaId, quiet = false) => {
        if (!mediaId) return;
        if (!quiet) setIsLoadingComments(true);
        setError('');
        try {
            const response = await apiFetch(`/api/instagram/posts/${encodeURIComponent(mediaId)}/comments?limit=50`);
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'No se pudieron cargar los comentarios.');
            setComments(body.comments || []);
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            if (!quiet) setIsLoadingComments(false);
        }
    }, []);

    const loadReplies = async (commentId) => {
        try {
            const response = await apiFetch(`/api/instagram/comments/${encodeURIComponent(commentId)}/replies?limit=50`);
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las respuestas.');
            setComments((current) => current.map((item) => item.id === commentId ? { ...item, replies: body.replies || [] } : item));
        } catch (loadError) {
            setError(loadError.message);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        loadPosts();
    }, [isOpen, loadPosts]);

    useEffect(() => {
        if (isOpen && selectedPost?.id) loadComments(selectedPost.id);
    }, [isOpen, selectedPost?.id, loadComments]);

    useEffect(() => {
        if (!isOpen || !socket) return undefined;
        const handleCommentUpdate = (event) => {
            if (!event.media_id || String(event.media_id) === String(selectedPost?.id)) {
                loadComments(selectedPost?.id, true);
                loadPosts();
            }
        };
        socket.on('instagram-comment-updated', handleCommentUpdate);
        return () => socket.off('instagram-comment-updated', handleCommentUpdate);
    }, [isOpen, socket, selectedPost?.id, loadComments, loadPosts]);

    const refresh = async () => {
        setIsRefreshing(true);
        await loadPosts();
        if (selectedPost?.id) await loadComments(selectedPost.id, true);
        setIsRefreshing(false);
    };

    const sendReply = async (comment) => {
        const message = replyText.trim();
        if (!message || !comment?.id) return;
        setIsSendingReply(true);
        setError('');
        try {
            const response = await apiFetch(`/api/instagram/comments/${encodeURIComponent(comment.id)}/replies`, {
                method: 'POST',
                body: JSON.stringify({ message })
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'No se pudo responder el comentario.');
            const reply = {
                id: body.id || `local-${Date.now()}`,
                text: message,
                username: 'Tu respuesta',
                timestamp: new Date().toISOString()
            };
            setComments((current) => current.map((item) => item.id === comment.id
                ? { ...item, replies: [...(item.replies || []), reply] }
                : item));
            setExpandedCommentId(comment.id);
            setReplyText('');
            setReplyingTo(null);
        } catch (sendError) {
            setError(sendError.message);
        } finally {
            setIsSendingReply(false);
        }
    };

    if (!isOpen) return null;

    const thumbnail = (post) => post.thumbnail_url || post.media_url || null;
    const formatDate = (value) => value ? new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(15, 23, 42, 0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <section style={{ width: 'min(1100px, 100%)', height: 'min(760px, 94vh)', background: '#f8fafc', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(15,23,42,.28)' }}>
                <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', color: '#c13584', background: '#fdf2f8' }}><ImageIcon size={20} /></div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: '#111827', fontWeight: 750, fontSize: 16 }}>Posts de Instagram</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>Revisa comentarios y responde desde el CRM</div>
                    </div>
                    <button type="button" onClick={refresh} disabled={isRefreshing} title="Actualizar" style={{ border: '1px solid #e5e7eb', borderRadius: 9, background: '#fff', padding: 8, cursor: 'pointer' }}><RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} /></button>
                    <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 0, background: 'transparent', color: '#64748b', padding: 8, cursor: 'pointer' }}><X size={21} /></button>
                </header>

                {error && <div role="alert" style={{ margin: '12px 16px 0', padding: 10, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>{error}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 34%) 1fr', gap: 14, padding: 16, minHeight: 0, flex: 1 }}>
                    <aside style={{ ...panelStyle, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <strong style={{ color: '#1f2937', fontSize: 13 }}>Publicaciones</strong>
                            <span style={{ color: '#64748b', fontSize: 11 }}>{posts.length}</span>
                        </div>
                        <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 10, rowGap: 16, padding: '2px 3px 14px' }}>
                            {posts.map((post) => (
                                <button key={post.id} type="button" onClick={() => setSelectedPost(post)} style={{ position: 'relative', border: selectedPost?.id === post.id ? '2px solid #c13584' : '1px solid #e5e7eb', borderRadius: 9, overflow: 'hidden', padding: 0, aspectRatio: '1', background: '#f1f5f9', cursor: 'pointer' }} title={post.caption || 'Abrir publicación'}>
                                    {thumbnail(post) ? <img src={thumbnail(post)} alt="Publicación de Instagram" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8' }}><ImageIcon size={26} /></div>}
                                    <span style={{ position: 'absolute', bottom: 5, right: 5, borderRadius: 12, padding: '3px 6px', background: 'rgba(15,23,42,.72)', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><MessageCircle size={11} />{post.comments_count || 0}</span>
                                </button>
                            ))}
                        </div>
                        {isLoadingPosts && <div style={{ padding: 16, color: '#64748b', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><Loader2 size={16} className="animate-spin" />Cargando posts…</div>}
                        {!isLoadingPosts && !posts.length && !error && <p style={{ color: '#64748b', fontSize: 13 }}>No se encontraron publicaciones.</p>}
                    </aside>

                    <main style={{ ...panelStyle, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                        {selectedPost ? (
                            <>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #e5e7eb' }}>
                                    {thumbnail(selectedPost) && <img src={thumbnail(selectedPost)} alt="" style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 8, background: '#f1f5f9' }} />}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: '#1f2937', fontSize: 13 }}>{formatDate(selectedPost.timestamp)} · {selectedPost.media_type || 'Publicación'}</div>
                                        <div style={{ marginTop: 4, color: '#64748b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPost.caption || 'Sin descripción'}</div>
                                    </div>
                                    {selectedPost.permalink && <a href={selectedPost.permalink} target="_blank" rel="noreferrer" title="Abrir en Instagram" style={{ color: '#64748b' }}><ExternalLink size={17} /></a>}
                                </div>
                                <div style={{ padding: '12px 0', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 700, color: '#334155' }}>Comentarios ({comments.length})</div>
                                <div style={{ overflowY: 'auto', flex: 1, paddingTop: 8 }}>
                                    {isLoadingComments && <div style={{ padding: 14, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><Loader2 size={16} className="animate-spin" />Cargando comentarios…</div>}
                                    {!isLoadingComments && comments.map((comment) => (
                                        <article key={comment.id} style={{ padding: '12px 4px', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                                <strong style={{ fontSize: 13, color: '#1f2937' }}>@{comment.username || comment.from?.username || 'usuario'}</strong>
                                                <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(comment.timestamp)}</span>
                                            </div>
                                            <div style={{ marginTop: 5, color: '#334155', fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{comment.text || '[Comentario sin texto]'}</div>
                                            {expandedCommentId === comment.id && (comment.replies || []).map((reply) => (
                                                <div key={reply.id} style={{ margin: '8px 0 0 16px', paddingLeft: 10, borderLeft: '2px solid #fbcfe8', color: '#475569', fontSize: 12 }}><strong>{reply.username || reply.from?.username || 'Respuesta'}</strong> {reply.text}</div>
                                            ))}
                                            <button type="button" onClick={() => {
                                                if (expandedCommentId === comment.id) setExpandedCommentId(null);
                                                else { setExpandedCommentId(comment.id); loadReplies(comment.id); }
                                            }} style={{ margin: '8px 12px 0 0', border: 0, background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer', padding: 0 }}>{expandedCommentId === comment.id ? 'Ocultar respuestas' : 'Ver respuestas'}</button>
                                            <button type="button" onClick={() => { setReplyingTo(comment.id); setReplyText(''); }} style={{ marginTop: 8, border: 0, background: 'transparent', color: '#c13584', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Responder</button>
                                            {replyingTo === comment.id && (
                                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                    <input value={replyText} onChange={(event) => setReplyText(event.target.value)} maxLength={1000} placeholder="Escribe una respuesta…" style={{ flex: 1, minWidth: 0, border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 10px', fontSize: 13 }} />
                                                    <button type="button" onClick={() => sendReply(comment)} disabled={isSendingReply || !replyText.trim()} title="Enviar respuesta" style={{ border: 0, borderRadius: 8, background: '#c13584', color: '#fff', padding: '0 12px', cursor: 'pointer', opacity: isSendingReply || !replyText.trim() ? 0.6 : 1 }}><Send size={16} /></button>
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                    {!isLoadingComments && !comments.length && <p style={{ color: '#64748b', fontSize: 13, padding: 12 }}>Esta publicación aún no tiene comentarios.</p>}
                                </div>
                            </>
                        ) : (
                            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b', fontSize: 13 }}>{isLoadingPosts ? 'Cargando publicaciones…' : 'Selecciona una publicación para ver sus comentarios.'}</div>
                        )}
                    </main>
                </div>
            </section>
        </div>
    );
};

export default InstagramPostsModal;
