export interface Document {
    id: string;
    type: 'word' | 'excel';
    title: string;
    meta: {
        version: number;
        created_at: string;
        updated_at: string;
        schema_version: string;
        sources: any[];
    };
    sections: Section[];
    sheets: Sheet[];
}

export interface Section {
    id: string;
    heading: string;
    level: number;
    content: string;
    verification_status: string;
    children: Section[];
}

export interface Sheet {
    id: string;
    name: string;
    columns: Column[];
    rows: Row[];
}

export interface Column {
    id: string;
    name: string;
    type: string;
}

export interface Row {
    id: string;
    cells: Record<string, any>;
}
