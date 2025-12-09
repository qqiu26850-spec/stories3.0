
import React, { useState, useEffect, Suspense } from 'react';
import { View, Prompt } from './types';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import { getCurrentUserId, signOut } from './services/supabaseService';
import { Sparkles } from './components/Icon';

// --- Lazy Loaded Components ---
const CreativeGeneration = React.lazy(() => import('./components/CreativeGeneration').then(module => ({ default: (module as any).default || (module as any).CreativeGeneration })));
const PromptLibrary = React.lazy(() => import('./components/PromptLibrary'));
const AssetManagement = React.lazy(() => import('./components/AssetManagement'));
const NovelManagement = React.lazy(() => import('./components/NovelManagement'));
const ScriptManagement = React.lazy(() => import('./components/ScriptManagement'));
const PersonalCenter = React.lazy(() => import('./components/PersonalCenter'));
const WorkflowManagement = React.lazy(() => import('./components/WorkflowManagement'));

export type Theme = 'light' | 'dark';

// Simple Loading Spinner for Suspense Fallback
const PageLoading = () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-black">
        <div className="flex flex-col items-center gap-4">
            <Sparkles className="w-12 h-12 text-sky-500 animate-pulse" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">资源加载中...</p>
        </div>
    </div>
);

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('creative-generation');
  const [theme, setTheme] = useState<Theme>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // State to pass prompt data from Library to Generation
  const [generationParams, setGenerationParams] = useState<{prompt?: Prompt, values?: Record<string, string>}>({});

  useEffect(() => {
    const checkAuth = async () => {
        const userId = await getCurrentUserId();
        if (userId) {
            setIsAuthenticated(true);
            setShowAuthModal(false);
        } else {
            setIsAuthenticated(false);
            setShowAuthModal(true);
        }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
      await signOut();
      setIsAuthenticated(false);
      setShowAuthModal(true);
      setActiveView('creative-generation'); // Reset view
  };

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleNavigateToGeneration = (prompt: Prompt, values: Record<string, string>) => {
    setGenerationParams({ prompt, values });
    setActiveView('creative-generation');
  };

  const renderContent = () => {
    switch (activeView) {
      case 'creative-generation':
        return (
          <CreativeGeneration 
            initialData={generationParams} 
            onClearInitialData={() => setGenerationParams({})} 
          />
        );
      case 'prompt-library':
        return <PromptLibrary onNavigateToGeneration={handleNavigateToGeneration} />;
      case 'workflow':
        return <WorkflowManagement />;
      case 'character-library':
      case 'plot-library':
      case 'inspiration-library':
        return <AssetManagement view={activeView} setActiveView={setActiveView} />;
      case 'novel-management':
        return <NovelManagement mode="long" />;
      case 'hit-copywriting':
        return <NovelManagement mode="short" />;
      case 'script-management':
        return <ScriptManagement />;
      case 'personal-center':
        return <PersonalCenter onLogout={handleLogout} />;
      default:
        return <CreativeGeneration />;
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-black text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      <AuthModal 
        isOpen={showAuthModal} 
        onSuccess={() => {
            setIsAuthenticated(true);
            setShowAuthModal(false);
            // Optional: reload data if needed, or just let components re-mount
            window.location.reload();
        }} 
      />
      
      {isAuthenticated && (
          <>
            <Sidebar 
                activeView={activeView} 
                setActiveView={setActiveView} 
                isCollapsed={isSidebarCollapsed}
                toggleSidebar={toggleSidebar}
                theme={theme}
                toggleTheme={toggleTheme}
            />
            <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-black relative">
                <Suspense fallback={<PageLoading />}>
                    {renderContent()}
                </Suspense>
            </main>
          </>
      )}
    </div>
  );
};

export default App;