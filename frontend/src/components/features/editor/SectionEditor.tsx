import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Document } from '../../../types';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '../../ui/toast';
import { EmptyState } from '../../ui/empty-state';

interface SectionEditorProps {
    document: Document;
    onUpdate: (doc: Document) => void;
}

export const SectionEditor: React.FC<SectionEditorProps> = ({ document, onUpdate }) => {
    const { success } = useToast();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleAddSection = () => {
        const updated = { ...document };
        const newSection = {
            id: `section-${Date.now()}`,
            heading: 'New Section',
            level: 1,
            content: '',
            verification_status: 'verified',
            children: [],
        };
        updated.sections.push(newSection);
        onUpdate(updated);
        setExpandedId(newSection.id);
    };

    const handleDeleteSection = (sectionId: string) => {
        const updated = { ...document };
        updated.sections = updated.sections.filter(s => s.id !== sectionId);
        onUpdate(updated);
        success('Section deleted');
    };

    const handleHeadingChange = (sectionId: string, heading: string) => {
        const updated = { ...document };
        const sec = updated.sections.find(s => s.id === sectionId);
        if (sec) sec.heading = heading;
        onUpdate(updated);
    };

    if (document.sections.length === 0) {
        return (
            <div>
                <EmptyState
                    icon="document"
                    title="No sections yet"
                    description="Add sections to build your document"
                    action={{ label: 'Add section', onClick: handleAddSection }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {document.sections.map((section, index) => (
                <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group border border-border rounded-xl overflow-hidden bg-background"
                >
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-secondary/30 border-b border-border">
                        <div className="text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical size={14} />
                        </div>
                        <span className="text-2xs text-muted-foreground/50 w-5">{index + 1}</span>
                        <input
                            value={section.heading}
                            onChange={(e) => handleHeadingChange(section.id, e.target.value)}
                            className="flex-1 bg-transparent text-[14px] font-medium focus:outline-none"
                            placeholder="Section heading"
                        />
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleDeleteSection(section.id)}
                                className="p-1.5 text-muted-foreground/50 hover:text-destructive transition-colors"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <textarea
                        value={section.content}
                        onChange={(e) => {
                            const updated = { ...document };
                            const sec = updated.sections.find(s => s.id === section.id);
                            if (sec) sec.content = e.target.value;
                            onUpdate(updated);
                        }}
                        placeholder="Write your content here..."
                        className="w-full min-h-[140px] p-4 text-[15px] leading-[1.7] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/30"
                    />
                </motion.div>
            ))}

            {/* Add section button */}
            <button
                onClick={handleAddSection}
                className="w-full flex items-center justify-center gap-2 py-4 text-[13px] text-muted-foreground border border-dashed border-border rounded-xl hover:bg-secondary/30 hover:text-foreground transition-all"
            >
                <Plus size={14} />
                Add section
            </button>
        </div>
    );
};
