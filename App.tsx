
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
import ManuscriptReview from './components/ManuscriptReview';

export type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('creative-generation');
  const [theme, setTheme] = useState<Theme>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // State to pass prompt data from Library to Generation
  const [generationParams, setGenerationParams] = useState<{prompt?: Prompt, values?: Record<string, string>}>({});

  useEffect(() => {
    const checkAuth = async () => {
        try {
            const userId = await getCurrentUserId();
            if (userId) {
                setIsAuthenticated(true);
                setShowAuthModal(false);
            } else {
                setIsAuthenticated(false);
                setShowAuthModal(true);
            }
        } catch (e) {
            console.warn("Auth check failed:", e);
            setIsAuthenticated(false);
            setShowAuthModal(true);
        }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
      try {
          await signOut();
      } catch (e) {
          // ignore
      }
      setIsAuthenticated(false);
      setIsGuestMode(false);
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
        isOpen={showAuthModal && !isGuestMode} 
        onSuccess={() => {
            setIsAuthenticated(true);
            setIsGuestMode(false);
            setShowAuthModal(false);
            window.location.reload();
        }}
        onGuestMode={() => {
            setIsGuestMode(true);
            setShowAuthModal(false);
        }}
      />
      
      {(isAuthenticated || isGuestMode) && (
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
            <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-black relative flex flex-col">
                {isGuestMode && (
                    <div className="bg-sky-50 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900/40 px-4 py-2 flex items-center justify-between text-xs text-sky-700 dark:text-sky-300 z-20">
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                            <span>当前处于<strong>访客体验模式</strong>（创作内容保存在本地），登录可开启云端自动同步。</span>
                        </div>
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold shadow-sm transition-all"
                        >
                            立即登录 / 注册
                        </button>
                    </div>
                )}
                
                {/* Modified: Only render when active to force reset state on revisit */}
                {activeView === 'creative-generation' && (
                    <div className="block h-full">
                        <CreativeGeneration 
                            initialData={generationParams} 
                            onClearInitialData={() => setGenerationParams({})} 
                        />
                    </div>
                )}

                <div className={activeView === 'prompt-library-novel' ? 'block h-full' : 'hidden h-full'}>
                    <PromptLibrary 
                        isActive={activeView === 'prompt-library-novel'} 
                        onNavigateToGeneration={handleNavigateToGeneration} 
                        mode="novel"
                    />
                </div>
                <div className={activeView === 'prompt-library-marketing' ? 'block h-full' : 'hidden h-full'}>
                    <PromptLibrary 
                        isActive={activeView === 'prompt-library-marketing'} 
                        onNavigateToGeneration={handleNavigateToGeneration} 
                        mode="marketing"
                    />
                </div>
                <div className={activeView === 'prompt-library-image' ? 'block h-full' : 'hidden h-full'}>
                    <PromptLibrary 
                        isActive={activeView === 'prompt-library-image'} 
                        onNavigateToGeneration={handleNavigateToGeneration} 
                        mode="image"
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

                <div className={activeView === 'manuscript-review' ? 'block h-full' : 'hidden h-full'}>
                    <ManuscriptReview isActive={activeView === 'manuscript-review'} />
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
