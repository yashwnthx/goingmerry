import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';

interface SignupPromptProps {
    open: boolean;
    onClose: () => void;
}

export const SignupPrompt: React.FC<SignupPromptProps> = ({ open, onClose }) => {
    const navigate = useNavigate();

    const handleSignup = () => {
        onClose();
        navigate('/signup');
    };

    const handleLogin = () => {
        onClose();
        navigate('/login');
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
                    />
                    
                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-6"
                    >
                        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg relative">
                            {/* Close button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X size={18} />
                            </button>

                            {/* Content */}
                            <div className="text-center">
                                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto mb-5">
                                    <Sparkles size={24} className="text-foreground" />
                                </div>
                                
                                <h2 className="text-[1.5rem] tracking-[-0.02em] mb-2">
                                    You've used your free prompts
                                </h2>
                                <p className="text-muted-foreground text-[15px] mb-6">
                                    Create a free account to continue generating unlimited documents.
                                </p>

                                {/* Actions */}
                                <div className="space-y-3">
                                    <button
                                        onClick={handleSignup}
                                        className="w-full h-11 bg-foreground text-background text-[14px] rounded-xl hover:opacity-90 transition-all font-medium"
                                    >
                                        Create free account
                                    </button>
                                    <button
                                        onClick={handleLogin}
                                        className="w-full h-11 border border-border text-[14px] rounded-xl hover:bg-secondary transition-all"
                                    >
                                        I already have an account
                                    </button>
                                </div>

                                <p className="text-2xs text-muted-foreground/60 mt-5">
                                    No credit card required
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
