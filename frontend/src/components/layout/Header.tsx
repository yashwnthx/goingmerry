import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Github, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuth();
    
    const isActive = (path: string) => location.pathname === path;

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="h-full max-w-2xl mx-auto px-6 flex items-center justify-between">
                {/* Logo */}
                <Link 
                    to="/" 
                    className="text-foreground hover:opacity-70 transition-opacity"
                >
                    <span className="text-[17px] tracking-[-0.02em] font-medium">Merry</span>
                </Link>

                {/* Navigation */}
                <nav className="flex items-center gap-1">
                    <Link
                        to="/"
                        className={`px-3 h-8 flex items-center text-[13px] rounded-full transition-colors ${
                            isActive('/') 
                                ? 'text-foreground bg-secondary' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Create
                    </Link>
                    {isAuthenticated && (
                        <Link
                            to="/history"
                            className={`px-3 h-8 flex items-center text-[13px] rounded-full transition-colors ${
                                isActive('/history') || location.pathname.startsWith('/editor')
                                    ? 'text-foreground bg-secondary' 
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            History
                        </Link>
                    )}
                    <div className="w-px h-4 bg-border mx-2" />
                    {isAuthenticated ? (
                        <div className="flex items-center gap-2">
                            <span className="text-2xs text-muted-foreground hidden sm:inline">
                                {user?.name}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                                title="Logout"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <Link
                            to="/login"
                            className="px-3 h-8 flex items-center text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Sign in
                        </Link>
                    )}
                    <a
                        href="https://github.com/yashwnthx/goingmerry"
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        title="GitHub"
                    >
                        <Github size={16} />
                    </a>
                </nav>
            </div>
        </header>
    );
};
