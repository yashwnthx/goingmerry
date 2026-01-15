import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, FileText, Table } from 'lucide-react';
import { parseIntent, createDocument } from '../services/api';
import { Document } from '../types';
import { Spinner } from '../components/ui/spinner';

interface HomeProps {
    onDocumentCreated: (doc: Document) => void;
    onError: (msg: string) => void;
    onBeforeCreate?: () => boolean;
    promptsRemaining?: number;
}

const examples = [
    { label: 'Sales Report', type: 'excel' as const },
    { label: 'Project Proposal', type: 'word' as const },
    { label: 'Competitor Analysis', type: 'excel' as const },
    { label: 'Meeting Notes', type: 'word' as const },
];

const MAX_CHARS = 500;
const MIN_CHARS = 10;

export const Home: React.FC<HomeProps> = ({ onDocumentCreated, onError, onBeforeCreate }) => {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const validatePrompt = useCallback((text: string): string | null => {
        const trimmed = text.trim();
        if (!trimmed) return 'Please describe what you want to create';
        if (trimmed.length < MIN_CHARS) return `Please provide more details (at least ${MIN_CHARS} characters)`;
        if (trimmed.length > MAX_CHARS) return `Prompt is too long (max ${MAX_CHARS} characters)`;
        return null;
    }, []);

    const handleCreate = async () => {
        if (loading) return;
        
        // Check guest limit
        if (onBeforeCreate && !onBeforeCreate()) {
            return;
        }

        const error = validatePrompt(prompt);
        if (error) {
            onError(error);
            return;
        }

        const trimmed = prompt.trim();
        setLoading(true);

        // Cancel any previous request
        if (abortRef.current) {
            abortRef.current.abort();
        }
        abortRef.current = new AbortController();

        try {
            const intent = await parseIntent(trimmed);
            
            // Build sections for Word docs
            const sections = intent.document_type === 'word'
                ? (intent.sections || []).map((sec: any, i: number) => ({
                    id: `section-${i}`,
                    heading: sec.heading || `Section ${i + 1}`,
                    level: 1,
                    content: sec.content || '',
                    verification_status: 'verified',
                    children: [],
                }))
                : [];

            // Build sheets for Excel docs
            const sheets = intent.document_type === 'excel'
                ? [{
                    id: 'sheet-1',
                    name: 'Data',
                    columns: [
                        ...(intent.columns || [])
                            .filter((c: string) => c && c.toLowerCase() !== 'source')
                            .map((name: string, i: number) => ({
                                id: `col-${i}`,
                                name,
                                type: 'string',
                            })),
                        { id: 'col-source', name: 'source', type: 'string' },
                    ],
                    rows: (intent.sample_data || []).map((row: any, i: number) => {
                        const cells: Record<string, any> = {};
                        const columns = intent.columns || [];
                        columns.forEach((col: string, j: number) => {
                            if (col.toLowerCase() !== 'source') {
                                cells[`col-${j}`] = row[col] ?? '';
                            }
                        });
                        cells['col-source'] = row.source ?? '';
                        return { id: `row-${i}`, cells };
                    }),
                }]
                : [];

            const doc = await createDocument({
                title: intent.topic || trimmed.slice(0, 50),
                type: intent.document_type || 'word',
                sections,
                sheets,
            });

            setPrompt('');
            onDocumentCreated(doc);
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return;
            const msg = e instanceof Error ? e.message : 'Failed to create document. Please try again.';
            onError(msg);
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    };

    const handleExampleClick = (example: typeof examples[0]) => {
        const prompts: Record<string, string> = {
            'Sales Report': 'Create a quarterly sales report with revenue by region, top products, and growth trends',
            'Project Proposal': 'Write a project proposal for a mobile app redesign including timeline, budget, and deliverables',
            'Competitor Analysis': 'Build a competitor analysis spreadsheet comparing features, pricing, and market position',
            'Meeting Notes': 'Create a meeting notes template with action items, decisions, and attendees sections',
        };
        setPrompt(prompts[example.label] || '');
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !loading) {
            e.preventDefault();
            handleCreate();
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="w-full max-w-xl"
            >
                {/* Headline */}
                <div className="text-center mb-10">
                    <h1 className="text-[2rem] leading-[1.1] tracking-[-0.03em] mb-3">
                        Create <span className="font-accent">documents</span>
                    </h1>
                    <p className="text-muted-foreground text-[15px]">
                        Describe what you need. Get Word or Excel files instantly.
                    </p>
                </div>

                {/* Input area */}
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => {
                            if (e.target.value.length <= MAX_CHARS) {
                                setPrompt(e.target.value);
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="A quarterly sales report with revenue breakdown by region..."
                        disabled={loading}
                        className="w-full h-36 px-4 py-4 text-[15px] bg-secondary/50 border border-border rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-foreground/10 placeholder:text-muted-foreground/50 transition-all disabled:opacity-60"
                    />
                    
                    {/* Footer */}
                    <div className="flex items-center justify-end mt-3">
                        <button
                            onClick={handleCreate}
                            disabled={loading || !prompt.trim()}
                            className="inline-flex items-center gap-2 px-5 h-10 bg-foreground text-background text-[14px] rounded-full disabled:opacity-40 transition-all hover:opacity-90"
                        >
                            {loading ? (
                                <>
                                    <Spinner size="sm" className="border-background/30 border-t-background" />
                                    <span>Creating...</span>
                                </>
                            ) : (
                                <>
                                    Generate
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Examples */}
                <div className="mt-8">
                    <p className="text-2xs text-muted-foreground/60 text-center mb-3">Try an example</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {examples.map((example) => (
                            <button
                                key={example.label}
                                onClick={() => handleExampleClick(example)}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-3 h-8 text-[13px] text-muted-foreground border border-border rounded-full hover:bg-secondary/50 hover:text-foreground transition-all disabled:opacity-50"
                            >
                                {example.type === 'word' ? <FileText size={12} /> : <Table size={12} />}
                                {example.label}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
