
import React, { useState, useEffect } from 'react';
import { View, Prompt } from './types';
import Sidebar from './components/Sidebar';
import CreativeGeneration from './components/CreativeGeneration';
import PromptLibrary from './components/PromptLibrary';
import AssetManagement from './components/AssetManagement';
import NovelManagement from './components/NovelManagement';
import ScriptManagement from './components/ScriptManagement';
import PersonalCenter from './components/PersonalCenter';
import Placeholder from './components/Placeholder';
import WorkflowManagement from './components/WorkflowManagement';

export type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('creative-generation');
  const [theme, setTheme] = useState<Theme>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // State to pass prompt data from Library to Generation
  const [generationParams, setGenerationParams] = useState<{prompt?: Prompt, values?: Record<string, string>}>({});

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
        return <PersonalCenter />;
      default:
        return <CreativeGeneration />;
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-black text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-black relative">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
