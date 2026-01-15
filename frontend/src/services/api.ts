import { Document } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

// Token Management
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
    accessToken = token;
}

export function getAccessToken(): string | null {
    return accessToken;
}

function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
}

// Request Cache (for GET requests only)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.data as T;
    }
    cache.delete(key);
    return null;
}

function setCache(key: string, data: any): void {
    cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(pattern?: string): void {
    if (!pattern) {
        cache.clear();
        return;
    }
    for (const key of cache.keys()) {
        if (key.includes(pattern)) {
            cache.delete(key);
        }
    }
}

// Request with timeout and retry
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = MAX_RETRIES
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            
            // Retry on network errors
            if (retries > 0 && !options.signal?.aborted) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return fetchWithRetry(url, options, retries - 1);
            }
        }
        
        throw new Error('Network error. Please check your connection.');
    }
}

// Response Handler
async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        let message = 'Request failed';
        try {
            const error = await res.json();
            message = error.detail || error.message || message;
        } catch {
            if (res.status === 401) message = 'Session expired. Please sign in again.';
            else if (res.status === 403) message = 'Access denied';
            else if (res.status === 404) message = 'Not found';
            else if (res.status >= 500) message = 'Server error. Please try again.';
        }
        throw new Error(message);
    }
    
    const text = await res.text();
    if (!text) return {} as T;
    
    try {
        return JSON.parse(text);
    } catch {
        return {} as T;
    }
}

// Auth Types
export interface User {
    id: string;
    email: string;
    name: string | null;
    avatar_url?: string | null;
}

export interface Session {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
}

export interface AuthResponse {
    user: User;
    session: Session | null;
}

// Auth API
export async function signUp(email: string, password: string, name?: string): Promise<AuthResponse> {
    const res = await fetchWithRetry(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
    });
    const result = await handleResponse<AuthResponse>(res);
    invalidateCache();
    return result;
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
    const res = await fetchWithRetry(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const result = await handleResponse<AuthResponse>(res);
    invalidateCache();
    return result;
}

export async function signOut(): Promise<void> {
    try {
        await fetchWithRetry(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: getAuthHeaders(),
        }, 0);
    } catch {
        // Ignore logout errors
    }
    invalidateCache();
}

export async function refreshSession(refreshToken: string): Promise<AuthResponse> {
    const res = await fetchWithRetry(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
    }, 0);
    return handleResponse<AuthResponse>(res);
}

export async function getCurrentUser(): Promise<User> {
    const cacheKey = 'current-user';
    const cached = getCached<User>(cacheKey);
    if (cached) return cached;

    const res = await fetchWithRetry(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders(),
    }, 0);
    const user = await handleResponse<User>(res);
    setCache(cacheKey, user);
    return user;
}

export async function resetPassword(email: string): Promise<void> {
    await fetchWithRetry(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    }, 0);
}

// Documents API
export async function parseIntent(prompt: string) {
    const res = await fetchWithRetry(`${API_BASE}/ai/parse-intent`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ prompt }),
    });
    return handleResponse(res);
}

export async function createDocument(doc: { 
    title: string; 
    type: string; 
    sections?: any[]; 
    sheets?: any[] 
}): Promise<Document> {
    const res = await fetchWithRetry(`${API_BASE}/documents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(doc),
    });
    const result = await handleResponse<Document>(res);
    invalidateCache('documents');
    return result;
}

export async function listDocuments(): Promise<Document[]> {
    const cacheKey = 'documents-list';
    const cached = getCached<{ documents: Document[] }>(cacheKey);
    if (cached) return cached.documents;

    const res = await fetchWithRetry(`${API_BASE}/documents`, {
        headers: getAuthHeaders(),
    });
    const data = await handleResponse<{ documents: Document[] } | Document[]>(res);
    const documents = Array.isArray(data) ? data : (data.documents || []);
    setCache(cacheKey, { documents });
    return documents;
}

export async function getDocument(id: string): Promise<Document> {
    const cacheKey = `document-${id}`;
    const cached = getCached<Document>(cacheKey);
    if (cached) return cached;

    const res = await fetchWithRetry(`${API_BASE}/documents/${id}`, {
        headers: getAuthHeaders(),
    });
    const doc = await handleResponse<Document>(res);
    setCache(cacheKey, doc);
    return doc;
}

export async function updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const res = await fetchWithRetry(`${API_BASE}/documents/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
    });
    const result = await handleResponse<Document>(res);
    invalidateCache(`document-${id}`);
    invalidateCache('documents-list');
    return result;
}

export async function deleteDocument(id: string): Promise<void> {
    const res = await fetchWithRetry(`${API_BASE}/documents/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'Failed to delete' }));
        throw new Error(error.detail || 'Failed to delete');
    }
    invalidateCache(`document-${id}`);
    invalidateCache('documents-list');
}

export async function exportDocument(docId: string, format: 'word' | 'excel' | 'pdf') {
    const res = await fetchWithRetry(`${API_BASE}/export/${docId}/${format}`, {
        headers: getAuthHeaders(),
    });
    
    if (!res.ok) {
        throw new Error('Export failed. Please try again.');
    }
    
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const extensions = { word: 'docx', excel: 'xlsx', pdf: 'pdf' };
    a.download = `document.${extensions[format]}`;
    a.click();
    
    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

export async function rewriteSection(data: { 
    section_id: string; 
    instructions: string; 
    content: string 
}) {
    const res = await fetchWithRetry(`${API_BASE}/ai/rewrite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
            section_id: data.section_id,
            instructions: data.instructions,
            content: data.content,
            preserve_heading: true
        }),
    });
    return handleResponse(res);
}
