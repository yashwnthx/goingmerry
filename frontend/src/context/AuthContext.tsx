import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { 
    signIn as apiSignIn, 
    signUp as apiSignUp, 
    signOut as apiSignOut,
    refreshSession,
    getCurrentUser,
    setAccessToken,
    invalidateCache,
    User,
    Session,
} from '../services/api';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    promptsUsed: number;
    maxFreePrompts: number;
    canUsePrompt: boolean;
    incrementPromptUsage: () => void;
    showSignupPrompt: boolean;
    setShowSignupPrompt: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_FREE_PROMPTS = 5;
const STORAGE_KEY_SESSION = 'merry_session';
const STORAGE_KEY_USAGE = 'merry_prompts_used';
const TOKEN_REFRESH_MARGIN = 60000; // Refresh 1 minute before expiry

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [promptsUsed, setPromptsUsed] = useState(0);
    const [showSignupPrompt, setShowSignupPrompt] = useState(false);
    
    const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const sessionRef = useRef<Session | null>(null);

    // Schedule token refresh
    const scheduleRefresh = useCallback((session: Session) => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }

        if (!session.expires_at) return;

        const expiresAt = session.expires_at * 1000;
        const now = Date.now();
        const refreshIn = Math.max(expiresAt - now - TOKEN_REFRESH_MARGIN, 0);

        if (refreshIn <= 0) {
            // Token already expired or about to expire, refresh now
            handleRefresh(session.refresh_token);
            return;
        }

        refreshTimeoutRef.current = setTimeout(() => {
            handleRefresh(session.refresh_token);
        }, refreshIn);
    }, []);

    // Handle token refresh
    const handleRefresh = useCallback(async (refreshToken: string) => {
        try {
            const result = await refreshSession(refreshToken);
            if (result.session) {
                setAccessToken(result.session.access_token);
                localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(result.session));
                sessionRef.current = result.session;
                setUser(result.user);
                scheduleRefresh(result.session);
            }
        } catch {
            // Refresh failed, clear session
            clearSession();
        }
    }, [scheduleRefresh]);

    // Clear session
    const clearSession = useCallback(() => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }
        setAccessToken(null);
        setUser(null);
        sessionRef.current = null;
        localStorage.removeItem(STORAGE_KEY_SESSION);
        invalidateCache();
    }, []);

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            try {
                const storedSession = localStorage.getItem(STORAGE_KEY_SESSION);
                if (storedSession) {
                    const session: Session = JSON.parse(storedSession);
                    sessionRef.current = session;
                    
                    const now = Math.floor(Date.now() / 1000);
                    const isExpired = session.expires_at && session.expires_at < now;
                    
                    if (isExpired) {
                        await handleRefresh(session.refresh_token);
                    } else {
                        setAccessToken(session.access_token);
                        try {
                            const userData = await getCurrentUser();
                            setUser(userData);
                            scheduleRefresh(session);
                        } catch {
                            // Token invalid, try refresh
                            await handleRefresh(session.refresh_token);
                        }
                    }
                }
                
                // Load guest usage count
                const storedUsage = localStorage.getItem(STORAGE_KEY_USAGE);
                if (storedUsage) {
                    const usage = parseInt(storedUsage, 10);
                    if (!isNaN(usage)) setPromptsUsed(usage);
                }
            } catch {
                clearSession();
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();

        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [handleRefresh, scheduleRefresh, clearSession]);

    const login = async (email: string, password: string) => {
        const result = await apiSignIn(email, password);
        
        if (result.session) {
            setAccessToken(result.session.access_token);
            localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(result.session));
            sessionRef.current = result.session;
            scheduleRefresh(result.session);
        }
        
        setUser(result.user);
        setPromptsUsed(0);
        localStorage.removeItem(STORAGE_KEY_USAGE);
    };

    const signup = async (name: string, email: string, password: string) => {
        const result = await apiSignUp(email, password, name);
        
        if (result.session) {
            setAccessToken(result.session.access_token);
            localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(result.session));
            sessionRef.current = result.session;
            scheduleRefresh(result.session);
        }
        
        setUser(result.user);
        setPromptsUsed(0);
        localStorage.removeItem(STORAGE_KEY_USAGE);
    };

    const logout = async () => {
        try {
            await apiSignOut();
        } catch {
            // Ignore logout errors
        }
        clearSession();
    };

    const incrementPromptUsage = useCallback(() => {
        if (!user) {
            setPromptsUsed(prev => {
                const newCount = prev + 1;
                localStorage.setItem(STORAGE_KEY_USAGE, newCount.toString());
                if (newCount >= MAX_FREE_PROMPTS) {
                    setShowSignupPrompt(true);
                }
                return newCount;
            });
        }
    }, [user]);

    const canUsePrompt = user !== null || promptsUsed < MAX_FREE_PROMPTS;

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            login,
            signup,
            logout,
            promptsUsed,
            maxFreePrompts: MAX_FREE_PROMPTS,
            canUsePrompt,
            incrementPromptUsage,
            showSignupPrompt,
            setShowSignupPrompt,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
