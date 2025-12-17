
import React, { useState, useEffect } from 'react';
import { View } from '../types';
import { Icon, BookOpen, Film, Copy, Box, Database, UserCircle, ChevronDown, Sparkles, BookSolid, ChevronDoubleLeft, ChevronDoubleRight, Workflow, Sun, Moon } from './Icon';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
  isCollapsed: boolean;
  toggleSidebar: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, isCollapsed, toggleSidebar, theme, toggleTheme }) => {
  const [isCreationCenterOpen, setCreationCenterOpen] = useState(false);
  const [isAssetManagementOpen, setAssetManagementOpen] = useState(false);
  
  useEffect(() => {
    if (isCollapsed) {
        setCreationCenterOpen(false);
        setAssetManagementOpen(false);
    }
  }, [isCollapsed]);

  const isGroupActive = (views: View[]) => views.includes(activeView);

  const NavItem: React.FC<{ view: View; icon: Icon; label: string; onClick?: () => void }> = ({ view, icon, label, onClick }) => (
    <button
      onClick={() => {
          setActiveView(view);
          if(onClick) onClick();
      }}
      className={`flex items-center w-full py-3 text-sm font-medium transition-all duration-200 rounded-lg ${
        isCollapsed ? 'justify-center px-2' : 'px-4'
      } ${
        activeView === view
          ? 'bg-sky-500 text-white shadow-md'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
      }`}
      title={isCollapsed ? label : undefined}
    >
      {React.createElement(icon, { className: `w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}` })}
      {!isCollapsed && <span className="truncate">{label}</span>}
    </button>
  );

  const FlyoutNavItem: React.FC<{ view: View; icon: Icon; label: string; onClick?: () => void }> = ({ view, icon, label, onClick }) => (
       <button
        onClick={(e) => {
            e.stopPropagation();
            setActiveView(view);
            if (onClick) onClick();
        }}
        className={`flex items-center w-full py-2 px-3 text-sm rounded-md transition-colors ${
            activeView === view
            ? 'bg-sky-500 text-white'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        {React.createElement(icon, { className: "w-4 h-4 mr-3" })}
        <span className="whitespace-nowrap">{label}</span>
      </button>
  );

  const GroupItem: React.FC<{ 
      icon: Icon; 
      label: string; 
      isOpen: boolean; 
      toggleOpen: () => void; 
      children: React.ReactNode; 
      active: boolean;
  }> = ({ icon, label, isOpen, toggleOpen, children, active }) => {
      
      if (isCollapsed) {
          return (
              <div className="relative group flex justify-center w-full">
                  <button 
                      onClick={(e) => {
                          e.stopPropagation();
                          toggleOpen();
                      }}
                      className={`flex items-center justify-center w-full py-3 rounded-lg transition-colors ${
                          active 
                          ? 'bg-sky-100 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' 
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                      {React.createElement(icon, { className: "w-5 h-5" })}
                  </button>
                  
                  {/* Flyout Menu */}
                  <div className={`absolute left-full top-0 ml-2 w-40 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 p-2 transition-all z-50 ${
                      isOpen 
                      ? 'visible opacity-100' 
                      : 'invisible opacity-0 group-hover:visible group-hover:opacity-100'
                  }`}>
                      <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase border-b border-gray-100 dark:border-gray-800 mb-1">
                          {label}
                      </div>
                      <div className="space-y-1">
                        {children}
                      </div>
                  </div>
              </div>
          )
      }

      return (
          <div>
              <button
                  onClick={toggleOpen}
                  className={`flex items-center justify-between w-full py-3 px-4 text-sm font-medium rounded-lg transition-colors ${
                      active 
                      ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/10' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                  <div className="flex items-center overflow-hidden">
                      {React.createElement(icon, { className: "w-5 h-5 mr-3 flex-shrink-0" })}
                      <span className="truncate">{label}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-48 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                 <div className="pl-2 space-y-1">
                     {children}
                 </div>
              </div>
          </div>
      );
  }

  return (
    <aside className={`relative flex-shrink-0 bg-gray-50 dark:bg-black flex flex-col border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-30 ${isCollapsed ? 'w-20' : 'w-56'}`}>

      <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'px-6 justify-between'} border-b border-gray-100 dark:border-gray-800 flex-shrink-0`}>
        <div className="flex items-center gap-2 overflow-hidden">
            <BookSolid className="w-8 h-8 text-sky-500 flex-shrink-0" />
            {!isCollapsed && <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-wider truncate">奇思妙写</h1>}
        </div>
         {!isCollapsed && (
             <button
                onClick={toggleTheme}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-900 hover:text-amber-500 dark:hover:text-yellow-400 rounded-full transition-colors flex-shrink-0"
                title={theme === 'dark' ? '切换亮色模式' : '切换深色模式'}
            >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
        )}
      </div>

      <div className={`flex-grow p-3 space-y-2 [&::-webkit-scrollbar]:hidden ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`} style={{ scrollbarWidth: 'none' }}>
          
            <div><NavItem view="creative-generation" icon={Sparkles} label="创意生成" /></div>

            <GroupItem 
                icon={BookOpen} 
                label="创作中心" 
                isOpen={isCreationCenterOpen} 
                toggleOpen={() => setCreationCenterOpen(!isCreationCenterOpen)}
                active={isGroupActive(['novel-management', 'script-management', 'hit-copywriting'])}
            >
                {isCollapsed ? (
                    <>
                        <FlyoutNavItem view="novel-management" icon={BookOpen} label="长篇小说" onClick={() => setCreationCenterOpen(false)} />
                        <FlyoutNavItem view="script-management" icon={Film} label="剧本管理" onClick={() => setCreationCenterOpen(false)} />
                        <FlyoutNavItem view="hit-copywriting" icon={Copy} label="短篇管理" onClick={() => setCreationCenterOpen(false)} />
                    </>
                ) : (
                    <>
                        <NavItem view="novel-management" icon={BookOpen} label="长篇小说" />
                        <NavItem view="script-management" icon={Film} label="剧本管理" />
                        <NavItem view="hit-copywriting" icon={Copy} label="短篇管理" />
                    </>
                )}
            </GroupItem>
            
            <div><NavItem view="prompt-library" icon={Box} label="提示词库" /></div>
            <div><NavItem view="workflow" icon={Workflow} label="工作流" /></div>
            
            <GroupItem 
                icon={Database} 
                label="素材管理" 
                isOpen={isAssetManagementOpen} 
                toggleOpen={() => setAssetManagementOpen(!isAssetManagementOpen)}
                active={isGroupActive(['character-library', 'plot-library', 'inspiration-library'])}
            >
                {isCollapsed ? (
                    <>
                        <FlyoutNavItem view="character-library" icon={UserCircle} label="角色库" onClick={() => setAssetManagementOpen(false)} />
                        <FlyoutNavItem view="plot-library" icon={BookOpen} label="剧情库" onClick={() => setAssetManagementOpen(false)} />
                        <FlyoutNavItem view="inspiration-library" icon={Sparkles} label="灵光库" onClick={() => setAssetManagementOpen(false)} />
                    </>
                ) : (
                    <>
                        <NavItem view="character-library" icon={UserCircle} label="角色库" />
                        <NavItem view="plot-library" icon={BookOpen} label="剧情库" />
                        <NavItem view="inspiration-library" icon={Sparkles} label="灵光库" />
                    </>
                )}
            </GroupItem>
            
             <div><NavItem view="personal-center" icon={UserCircle} label="个人中心" /></div>

      </div>
      
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
        <button
            onClick={toggleSidebar}
            className={`flex items-center justify-center w-full py-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${isCollapsed ? '' : 'bg-gray-100 dark:bg-gray-900'}`}
            title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
        >
            {isCollapsed ? <ChevronDoubleRight className="w-5 h-5" /> : (
                <div className="flex items-center gap-2">
                    <ChevronDoubleLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">收起侧边栏</span>
                </div>
            )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
