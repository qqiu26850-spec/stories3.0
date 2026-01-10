
import React, { useState, useEffect } from 'react';
import { View, Prompt } from './types';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import VersionUpdateModal from './components/VersionUpdateModal'; // Import VersionUpdateModal
import { getCurrentUserId, signOut } from './services/supabaseService';

// --- Static Imports for Instant Access & Data Persistence ---
import CreativeGeneration from './components/CreativeGeneration';
import PromptLibrary from './components/PromptLibrary';
import AssetManagement from './components/AssetManagement';
import NovelManagement from './components/NovelManagement';
import ScriptManagement from './components/ScriptManagement';
import PersonalCenter from './components/PersonalCenter';
import WorkflowManagement from './components/WorkflowManagement';
import HelpCenter from './components/HelpCenter';

export type Theme = 'light' | 'dark';

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

  return (
    <div className="flex h-screen bg-white dark:bg-black text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      <AuthModal 
        isOpen={showAuthModal} 
        onSuccess={() => {
            setIsAuthenticated(true);
            setShowAuthModal(false);
            window.location.reload();
        }} 
      />
      
      {isAuthenticated && (
          <>
            <VersionUpdateModal /> {/* Add VersionUpdateModal here */}
            <Sidebar 
                activeView={activeView} 
                setActiveView={setActiveView} 
                isCollapsed={isSidebarCollapsed}
                toggleSidebar={toggleSidebar}
                theme={theme}
                toggleTheme={toggleTheme}
            />
            <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-black relative">
                
                {/* Modified: Only render when active to force reset state on revisit */}
                {activeView === 'creative-generation' && (
                    <div className="block h-full">
                        <CreativeGeneration 
                            initialData={generationParams} 
                            onClearInitialData={() => setGenerationParams({})} 
                        />
                    </div>
                )}

                <div className={activeView === 'prompt-library' ? 'block h-full' : 'hidden h-full'}>
                    <PromptLibrary 
                        isActive={activeView === 'prompt-library'} 
                        onNavigateToGeneration={handleNavigateToGeneration} 
                    />
                </div>

                <div className={activeView === 'workflow' ? 'block h-full' : 'hidden h-full'}>
                    <WorkflowManagement isActive={activeView === 'workflow'} />
                </div>

                <div className={activeView === 'character-library' ? 'block h-full' : 'hidden h-full'}>
                    <AssetManagement view="character-library" setActiveView={setActiveView} isActive={activeView === 'character-library'} />
                </div>
                <div className={activeView === 'plot-library' ? 'block h-full' : 'hidden h-full'}>
                    <AssetManagement view="plot-library" setActiveView={setActiveView} isActive={activeView === 'plot-library'} />
                </div>
                <div className={activeView === 'inspiration-library' ? 'block h-full' : 'hidden h-full'}>
                    <AssetManagement view="inspiration-library" setActiveView={setActiveView} isActive={activeView === 'inspiration-library'} />
                </div>

                <div className={activeView === 'novel-management' ? 'block h-full' : 'hidden h-full'}>
                    <NovelManagement mode="long" isActive={activeView === 'novel-management'} />
                </div>

                <div className={activeView === 'hit-copywriting' ? 'block h-full' : 'hidden h-full'}>
                    <NovelManagement mode="short" isActive={activeView === 'hit-copywriting'} />
                </div>

                <div className={activeView === 'script-management' ? 'block h-full' : 'hidden h-full'}>
                    <ScriptManagement isActive={activeView === 'script-management'} />
                </div>

                <div className={activeView === 'personal-center' ? 'block h-full' : 'hidden h-full'}>
                    <PersonalCenter onLogout={handleLogout} />
                </div>

                <div className={activeView === 'help' ? 'block h-full' : 'hidden h-full'}>
                    <HelpCenter onNavigate={setActiveView} />
                </div>

            </main>
          </>
      )}
    </div>
  );
};

export default App;
