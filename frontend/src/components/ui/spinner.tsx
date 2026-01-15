import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'w-4 h-4 border-[1.5px]',
    md: 'w-5 h-5 border-2',
    lg: 'w-6 h-6 border-2',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => {
    return (
        <div
            className={cn(
                'border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin',
                sizeClasses[size],
                className
            )}
        />
    );
};

export const PageLoader: React.FC = () => {
    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
            <Spinner size="lg" />
        </div>
    );
};
