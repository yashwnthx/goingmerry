import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Check, Cloud, CloudOff, AlertCircle } from 'lucide-react';
import { Document } from '../types';
import { SectionEditor } from '../components/features/editor/SectionEditor';
import { SheetEditor } from '../components/features/editor/SheetEditor';
import { getDocument, exportDocument, updateDocument, invalidateCache } from '../services/api';
import { useToast } from '../components/ui/toast';
import { Spinner, PageLoader } from '../components/ui/spinner';
import { EmptyState } from '../components/ui/empty-state';
import { useAuth } from '../context/AuthContext';

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export const Editor: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const { isAuthenticated } = useAuth();
    
    const goBack = () => isAuthenticated ? '/history' : '/';
    
    const [document, setDocument] = useState<Document | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exported, setExported] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const documentRef = useRef<Document | null>(null);
    const saveAttempts = useRef(0);
    const mountedRef = useRef(true);

    // Load document
    useEffect(() => {
        if (!id) return;
        
        mountedRef.current = true;
        setLoading(true);
        setError(null);
        
        getDocument(id)
            .then((doc) => {
                if (mountedRef.current) {
                    setDocument(doc);
                    documentRef.current = doc;
                    setLastSaved(new Date());
                }
            })
            .catch((e) => {
                if (mountedRef.current) {
                    setError(e instanceof Error ? e.message : 'Document not found');
                }
            })
            .finally(() => {
                if (mountedRef.current) {
                    setLoading(false);
                }
            });

        return () => { mountedRef.current = false; };
    }, [id]);

    // Save document with retry
    const saveDocument = useCallback(async () => {
        if (!documentRef.current || !id) return;
        
        setSaveStatus('saving');
        
        try {
            await updateDocument(id, documentRef.current);
            if (mountedRef.current) {
                setLastSaved(new Date());
                setSaveStatus('saved');
                saveAttempts.current = 0;
            }
        } catch (e) {
            if (mountedRef.current) {
                saveAttempts.current++;
                
                if (saveAttempts.current < 3) {
                    // Retry after delay
                    saveTimeoutRef.current = setTimeout(saveDocument, 2000 * saveAttempts.current);
                } else {
                    setSaveStatus('error');
                    showError('Failed to save. Please try again.');
                    saveAttempts.current = 0;
                }
            }
        }
    }, [id, showError]);

    // Handle document updates with debounced save
    const handleUpdate = useCallback((updatedDoc: Document) => {
        setDocument(updatedDoc);
        documentRef.current = updatedDoc;
        setSaveStatus('unsaved');

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(saveDocument, 1500);
    }, [saveDocument]);

    // Force save
    const forceSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveDocument();
    }, [saveDocument]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (saveStatus === 'unsaved') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveStatus]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    const handleExport = async () => {
        if (!document || exporting) return;
        
        setExporting(true);
        try {
            await exportDocument(document.id, document.type as any);
            setExported(true);
            success('Document exported');
            setTimeout(() => setExported(false), 2000);
        } catch (e) {
            showError(e instanceof Error ? e.message : 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleBack = async () => {
        if (saveStatus === 'unsaved') {
            await saveDocument();
        }
        invalidateCache('documents');
        navigate(goBack());
    };

    const formatLastSaved = () => {
        if (!lastSaved) return '';
        const now = new Date();
        const diff = now.getTime() - lastSaved.getTime();
        if (diff < 60000) return 'Saved';
        if (diff < 3600000) return `Saved ${Math.floor(diff / 60000)}m ago`;
        return `Saved ${Math.floor(diff / 3600000)}h ago`;
    };

    const renderSaveStatus = () => {
        switch (saveStatus) {
            case 'saving':
                return (
                    <>
                        <Cloud size={11} className="animate-pulse" />
                        Saving...
                    </>
                );
            case 'unsaved':
                return (
                    <>
                        <CloudOff size={11} />
                        Unsaved
                    </>
                );
            case 'error':
                return (
                    <button onClick={forceSave} className="flex items-center gap-1 text-destructive hover:underline">
                        <AlertCircle size={11} />
                        Save failed – retry
                    </button>
                );
            default:
                return (
                    <>
                        <Check size={11} />
                        {formatLastSaved()}
                    </>
                );
        }
    };

    if (loading) {
        return <PageLoader />;
    }

    if (error || !document) {
        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
                <EmptyState
                    icon="error"
                    title="Document not found"
                    description={error || "This document may have been deleted or moved"}
                    action={{ label: 'Go back', onClick: () => navigate(goBack()) }}
                />
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-2xl mx-auto"
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-8 gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <button
                            onClick={handleBack}
                            className="mt-1 p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-[1.25rem] tracking-[-0.02em] mb-1 truncate">
                                {document.title}
                            </h1>
                            <div className="flex items-center gap-3">
                                <span className="text-2xs text-muted-foreground">
                                    {document.type === 'word' ? 'Word' : 'Excel'}
                                </span>
                                <span className="text-2xs text-muted-foreground/50">·</span>
                                <span className="text-2xs text-muted-foreground/50 flex items-center gap-1">
                                    {renderSaveStatus()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="inline-flex items-center gap-2 px-4 h-9 text-[13px] border border-border rounded-full hover:bg-secondary transition-all disabled:opacity-50 flex-shrink-0"
                    >
                        {exported ? (
                            <>
                                <Check size={14} />
                                Done
                            </>
                        ) : exporting ? (
                            <Spinner size="sm" />
                        ) : (
                            <>
                                <Download size={14} />
                                Export
                            </>
                        )}
                    </button>
                </div>

                {/* Content */}
                {document.type === 'word' ? (
                    <SectionEditor document={document} onUpdate={handleUpdate} />
                ) : (
                    <SheetEditor document={document} onUpdate={handleUpdate} />
                )}
            </motion.div>
        </div>
    );
};
