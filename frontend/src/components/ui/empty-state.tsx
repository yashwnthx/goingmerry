import React from 'react';
import { FileText, FolderOpen, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
    icon?: 'document' | 'folder' | 'error';
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const icons = {
    document: FileText,
    folder: FolderOpen,
    error: AlertCircle,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = 'folder',
    title,
    description,
    action,
}) => {
    const Icon = icons[icon];

    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
                <Icon size={20} className="text-muted-foreground" />
            </div>
            <h3 className="text-[15px] mb-1">{title}</h3>
            {description && (
                <p className="text-[14px] text-muted-foreground max-w-xs">{description}</p>
            )}
            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-4 text-[14px] underline underline-offset-4 hover:opacity-70 transition-opacity"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};
