
import React from 'react';
import { Project } from '../types';
import { Trash, Pencil } from './Icon';

interface ProjectCardProps {
    project: Project;
    onDelete: (id: string) => void;
    onEdit?: (project: Project) => void;
    onSelect?: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete, onEdit, onSelect }) => {
    
    // Artistic Sky Blue Theme Gradient
    const gradientClass = "bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 dark:from-sky-700 dark:via-sky-800 dark:to-blue-900";

    return (
        <div className="group relative flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full">
            <div onClick={onSelect} className="cursor-pointer relative group/image aspect-[2/1] w-full overflow-hidden border-b border-gray-100 dark:border-gray-800">
                {/* Fixed Cover Design - Artistic Sky Blue Theme */}
                <div className={`w-full h-full flex flex-col items-center justify-center ${gradientClass} p-4 transition-transform duration-700 group-hover/image:scale-105 relative overflow-hidden`}>
                    
                    {/* Abstract Decorative Shapes */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-300/20 rounded-full blur-xl transform -translate-x-5 translate-y-5"></div>
                    
                    <div className="flex flex-col items-center justify-center border-2 border-white/30 bg-white/5 backdrop-blur-sm p-4 rounded-xl w-full h-full shadow-inner">
                        <div className="text-white font-black text-2xl tracking-[0.3em] ml-1 drop-shadow-md">
                            奇思妙写
                        </div>
                        <div className="w-8 h-1 bg-white/50 rounded-full mt-3 mb-2"></div>
                        <div className="text-white/80 text-[10px] font-bold uppercase tracking-widest">
                            AI Creative Studio
                        </div>
                    </div>
                </div>
                
                <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors" />
                
                {/* Floating Actions */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 translate-y-2 group-hover:translate-y-0">
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(project);
                            }}
                            className="p-2 bg-white/90 dark:bg-black/70 text-gray-600 dark:text-gray-300 rounded-full hover:bg-sky-500 hover:text-white dark:hover:bg-sky-500 transition-colors shadow-sm backdrop-blur-sm"
                            title="重命名"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(project.id);
                        }}
                        className="p-2 bg-white/90 dark:bg-black/70 text-gray-600 dark:text-gray-300 rounded-full hover:bg-red-500 hover:text-white dark:hover:bg-red-500 transition-colors shadow-sm backdrop-blur-sm"
                        title="删除作品"
                    >
                        <Trash className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="p-4 flex-grow flex flex-col">
                <h3 
                    className="font-bold text-lg text-gray-900 dark:text-white truncate mb-2 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                    onClick={onSelect}
                    title={project.title}
                >
                    {project.title}
                </h3>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center mb-4">
                    <span>字数: {project.wordCount.toLocaleString()}</span>
                    <span>{new Date(project.creationDate).toLocaleDateString()}</span>
                </div>
                
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onSelect) onSelect();
                    }}
                    className="mt-auto w-full py-2 px-4 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 hover:bg-sky-600 hover:text-white dark:hover:bg-sky-500 dark:hover:text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <Pencil className="w-4 h-4" />
                    开始创作
                </button>
            </div>
        </div>
    );
};

export default ProjectCard;
