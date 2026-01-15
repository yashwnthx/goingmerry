import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Document } from '../../../types';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '../../ui/toast';
import { EmptyState } from '../../ui/empty-state';

interface SheetEditorProps {
    document: Document;
    onUpdate: (doc: Document) => void;
}

export const SheetEditor: React.FC<SheetEditorProps> = ({ document, onUpdate }) => {
    const { success } = useToast();
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [resizing, setResizing] = useState<string | null>(null);
    const startXRef = useRef<number>(0);
    const startWidthRef = useRef<number>(0);

    if (!document.sheets[0]) {
        return (
            <EmptyState
                icon="document"
                title="No data yet"
                description="This spreadsheet has no data"
            />
        );
    }

    const sheet = document.sheets[0];
    const DEFAULT_WIDTH = 150;

    const getColumnWidth = (colId: string) => columnWidths[colId] || DEFAULT_WIDTH;

    const handleResizeStart = (e: React.MouseEvent, colId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setResizing(colId);
        startXRef.current = e.clientX;
        startWidthRef.current = getColumnWidth(colId);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const diff = moveEvent.clientX - startXRef.current;
            const newWidth = Math.max(80, startWidthRef.current + diff);
            setColumnWidths(prev => ({ ...prev, [colId]: newWidth }));
        };

        const handleMouseUp = () => {
            setResizing(null);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleDeleteRow = (rowId: string) => {
        const updated = { ...document };
        updated.sheets[0].rows = updated.sheets[0].rows.filter(r => r.id !== rowId);
        onUpdate(updated);
    };

    const handleAddRow = () => {
        const updated = { ...document };
        updated.sheets[0].rows.push({
            id: `row-${Date.now()}`,
            cells: {},
        });
        onUpdate(updated);
    };

    const handleAddColumn = () => {
        const updated = { ...document };
        const newColId = `col-${Date.now()}`;
        updated.sheets[0].columns.push({
            id: newColId,
            name: 'New Column',
            type: 'string',
        });
        onUpdate(updated);
        setEditingColumnId(newColId);
    };

    const handleDeleteColumn = (colId: string) => {
        const updated = { ...document };
        updated.sheets[0].columns = updated.sheets[0].columns.filter(c => c.id !== colId);
        updated.sheets[0].rows.forEach(row => {
            delete row.cells[colId];
        });
        onUpdate(updated);
        success('Column deleted');
    };

    const handleColumnNameChange = (colId: string, name: string) => {
        const updated = { ...document };
        const col = updated.sheets[0].columns.find(c => c.id === colId);
        if (col) col.name = name;
        onUpdate(updated);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-border rounded-xl overflow-hidden"
        >
            <div className="overflow-x-auto">
                <table className="text-[14px] border-collapse" style={{ minWidth: '100%' }}>
                    <thead>
                        <tr className="border-b border-border bg-secondary/30">
                            <th className="w-12 p-3 text-left text-2xs text-muted-foreground font-medium border-r border-border">#</th>
                            {sheet.columns.map((col, index) => (
                                <th 
                                    key={col.id} 
                                    className="p-0 text-left border-r border-border relative group"
                                    style={{ width: getColumnWidth(col.id), minWidth: 80 }}
                                >
                                    <div className="flex items-center gap-2 px-3 py-2">
                                        <span className="text-2xs text-muted-foreground/50 w-4 flex-shrink-0">
                                            {String.fromCharCode(65 + index)}
                                        </span>
                                        {editingColumnId === col.id ? (
                                            <input
                                                value={col.name}
                                                onChange={(e) => handleColumnNameChange(col.id, e.target.value)}
                                                onBlur={() => setEditingColumnId(null)}
                                                onKeyDown={(e) => e.key === 'Enter' && setEditingColumnId(null)}
                                                className="flex-1 bg-transparent text-[13px] font-medium focus:outline-none min-w-0"
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                onClick={() => setEditingColumnId(col.id)}
                                                className="flex-1 text-[13px] font-medium cursor-text truncate"
                                                title={col.name}
                                            >
                                                {col.name}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => handleDeleteColumn(col.id)}
                                            className="p-1 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    {/* Resize handle */}
                                    <div
                                        onMouseDown={(e) => handleResizeStart(e, col.id)}
                                        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 ${resizing === col.id ? 'bg-primary/50' : ''}`}
                                    />
                                </th>
                            ))}
                            <th className="w-12 p-3">
                                <button
                                    onClick={handleAddColumn}
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    title="Add column"
                                >
                                    <Plus size={14} />
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sheet.rows.length === 0 ? (
                            <tr>
                                <td colSpan={sheet.columns.length + 2} className="p-8 text-center text-muted-foreground text-[14px]">
                                    No rows yet. Click "Add row" to start.
                                </td>
                            </tr>
                        ) : (
                            sheet.rows.map((row, rowIndex) => (
                                <tr 
                                    key={row.id} 
                                    className="border-b border-border last:border-b-0 group hover:bg-secondary/10 transition-colors"
                                >
                                    <td className="p-3 border-r border-border bg-secondary/10">
                                        <div className="flex items-center gap-1 text-muted-foreground/30">
                                            <GripVertical size={12} className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <span className="text-2xs">{rowIndex + 1}</span>
                                        </div>
                                    </td>
                                    {sheet.columns.map((col) => (
                                        <td 
                                            key={col.id} 
                                            className="p-0 border-r border-border"
                                            style={{ width: getColumnWidth(col.id) }}
                                        >
                                            <input
                                                value={row.cells[col.id] || ''}
                                                onChange={(e) => {
                                                    const updated = { ...document };
                                                    const r = updated.sheets[0].rows.find(r => r.id === row.id);
                                                    if (r) r.cells[col.id] = e.target.value;
                                                    onUpdate(updated);
                                                }}
                                                placeholder="—"
                                                className="w-full h-full px-3 py-2 bg-transparent focus:outline-none focus:bg-secondary/20 text-[14px] placeholder:text-muted-foreground/20"
                                            />
                                        </td>
                                    ))}
                                    <td className="p-2">
                                        <button
                                            onClick={() => handleDeleteRow(row.id)}
                                            className="p-1 text-muted-foreground/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/10">
                <span className="text-2xs text-muted-foreground">
                    {sheet.rows.length} row{sheet.rows.length !== 1 ? 's' : ''} · {sheet.columns.length} column{sheet.columns.length !== 1 ? 's' : ''}
                </span>
                <button
                    onClick={handleAddRow}
                    className="flex items-center gap-1.5 px-3 h-7 text-2xs text-muted-foreground hover:text-foreground border border-border rounded-full hover:bg-secondary transition-colors"
                >
                    <Plus size={12} />
                    Add row
                </button>
            </div>
        </motion.div>
    );
};
