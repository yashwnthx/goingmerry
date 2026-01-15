import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Home } from './pages/Home';
import { Editor } from './pages/Editor';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { useToast } from './components/ui/toast';
import { useAuth } from './context/AuthContext';
import { SignupPrompt } from './components/ui/signup-prompt';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    
    if (isLoading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            </div>
        );
    }
    
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    
    return <>{children}</>;
}

function HomeWrapper() {
    const navigate = useNavigate();
    const { error } = useToast();
    const { incrementPromptUsage, canUsePrompt, setShowSignupPrompt, promptsUsed, maxFreePrompts, isAuthenticated } = useAuth();
    
    return (
        <Home
            onDocumentCreated={(doc) => {
                incrementPromptUsage();
                navigate(`/editor/${doc.id}`);
            }}
            onError={(msg) => error(msg)}
            onBeforeCreate={() => {
                if (!canUsePrompt) {
                    setShowSignupPrompt(true);
                    return false;
                }
                return true;
            }}
            promptsRemaining={isAuthenticated ? undefined : maxFreePrompts - promptsUsed}
        />
    );
}

export default function App() {
    const { showSignupPrompt, setShowSignupPrompt } = useAuth();

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 flex flex-col pt-14">
                <Routes>
                    <Route path="/" element={<HomeWrapper />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/history" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/editor/:id" element={<Editor />} />
                </Routes>
            </main>
            <SignupPrompt open={showSignupPrompt} onClose={() => setShowSignupPrompt(false)} />
        </div>
    );
}
