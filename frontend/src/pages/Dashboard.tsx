import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FileText, Table, Trash2, RefreshCw } from 'lucide-react';
import { listDocuments, deleteDocument, invalidateCache } from '../services/api';
import { Document } from '../types';
import { useToast } from '../components/ui/toast';
import { Spinner } from '../components/ui/spinner';
import { EmptyState } from '../components/ui/empty-state';

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const mountedRef = useRef(true);

    const fetchDocuments = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
            invalidateCache('documents');
        } else {
            setLoading(true);
        }
        setLoadError(null);

        try {
            const docs = await listDocuments();
            if (mountedRef.current) {
                setDocuments(docs);
            }
        } catch (e) {
            if (mountedRef.current) {
                const msg = e instanceof Error ? e.message : 'Failed to load documents';
                setLoadError(msg);
                if (isRefresh) {
                    showError(msg);
                }
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [showError]);

    useEffect(() => {
        mountedRef.current = true;
        fetchDocuments(false);
        return () => { mountedRef.current = false; };
    }, [fetchDocuments]);

    const handleDelete = async (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        if (deletingIds.has(doc.id)) return;

        // Optimistic update
        setDeletingIds(prev => new Set(prev).add(doc.id));
        setDocuments(prev => prev.filter(d => d.id !== doc.id));

        try {
            await deleteDocument(doc.id);
            success('Document deleted');
        } catch (e) {
            // Rollback on error
            setDocuments(prev => [...prev, doc].sort((a, b) => 
                new Date(b.meta?.updated_at || 0).getTime() - new Date(a.meta?.updated_at || 0).getTime()
            ));
            showError(e instanceof Error ? e.message : 'Failed to delete');
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(doc.id);
                return next;
            });
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Just now';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] px-6 py-12">
            <div className="max-w-2xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-[1.5rem] tracking-[-0.03em] mb-1">
                                History
                            </h1>
                            {!loading && documents.length > 0 && (
                                <p className="text-2xs text-muted-foreground">
                                    {documents.length} document{documents.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {!loading && (
                                <button
                                    onClick={() => fetchDocuments(true)}
                                    disabled={refreshing}
                                    className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                    title="Refresh"
                                >
                                    <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/')}
                                className="inline-flex items-center gap-2 px-4 h-9 text-[13px] border border-border rounded-full hover:bg-secondary transition-colors"
                            >
                                <Plus size={14} />
                                New
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div 
                                    key={i} 
                                    className="h-[72px] rounded-xl bg-secondary/30 animate-pulse"
                                    style={{ animationDelay: `${i * 100}ms` }}
                                />
                            ))}
                        </div>
                    ) : loadError ? (
                        <EmptyState
                            icon="error"
                            title="Couldn't load documents"
                            description={loadError}
                            action={{ label: 'Try again', onClick: () => fetchDocuments(true) }}
                        />
                    ) : documents.length === 0 ? (
                        <EmptyState
                            icon="folder"
                            title="No documents yet"
                            description="Create your first document to get started"
                            action={{ label: 'Create document', onClick: () => navigate('/') }}
                        />
                    ) : (
                        <div className="space-y-1">
                            <AnimatePresence mode="popLayout">
                                {documents.map((doc, index) => (
                                    <motion.div
                                        key={doc.id}
                                        layout
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: index * 0.03 }}
                                    >
                                        <div
                                            onClick={() => navigate(`/editor/${doc.id}`)}
                                            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors text-left group cursor-pointer"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0">
                                                {doc.type === 'word' ? <FileText size={16} /> : <Table size={16} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[15px] truncate">{doc.title}</p>
                                                <p className="text-2xs text-muted-foreground mt-0.5">
                                                    {doc.type === 'word' ? 'Word' : 'Excel'} · {formatDate(doc.meta?.updated_at || doc.meta?.created_at)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handleDelete(e, doc)}
                                                    disabled={deletingIds.has(doc.id)}
                                                    className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    {deletingIds.has(doc.id) ? (
                                                        <Spinner size="sm" />
                                                    ) : (
                                                        <Trash2 size={14} />
                                                    )}
                                                </button>
                                                <span className="text-2xs text-muted-foreground">
                                                    Open →
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};
