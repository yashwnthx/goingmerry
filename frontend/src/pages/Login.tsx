import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '../components/ui/toast';
import { Spinner } from '../components/ui/spinner';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { error: showError, success } = useToast();
    const { login, isAuthenticated, isLoading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Redirect if already authenticated
    if (authLoading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email.trim() || !password.trim()) {
            showError('Please fill in all fields');
            return;
        }

        setLoading(true);
        
        try {
            await login(email, password);
            success('Welcome back!');
            navigate('/');
        } catch (err) {
            showError(err instanceof Error ? err.message : 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-[1.5rem] tracking-[-0.03em] mb-2">
                        <span className="font-accent">Welcome back</span>
                    </h1>
                    <p className="text-[14px] text-muted-foreground">
                        Sign in to continue
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-2xs text-muted-foreground mb-1.5 ml-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            disabled={loading}
                            className="w-full h-11 px-4 text-[14px] bg-secondary/50 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-foreground/10 placeholder:text-muted-foreground/40 transition-all disabled:opacity-60"
                        />
                    </div>
                    <div>
                        <label className="block text-2xs text-muted-foreground mb-1.5 ml-1">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                disabled={loading}
                                className="w-full h-11 px-4 pr-10 text-[14px] bg-secondary/50 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-foreground/10 placeholder:text-muted-foreground/40 transition-all disabled:opacity-60"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 bg-foreground text-background text-[14px] rounded-xl disabled:opacity-50 transition-all hover:opacity-90 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Spinner size="sm" className="border-background/30 border-t-background" />
                                Signing in...
                            </>
                        ) : (
                            'Sign in'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <p className="mt-6 text-center text-[13px] text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-foreground underline underline-offset-4 hover:opacity-70">
                        Sign up
                    </Link>
                </p>
            </motion.div>
        </div>
    );
};
