import React from 'react';
import { Project } from '../types';
import { Trash, Photograph, Pencil } from './Icon';

interface ProjectCardProps {
    project: Project;
    onDelete: (id: string) => void;
    onSelect?: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete, onSelect }) => {
    return (
        <div className="group relative flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full">
            <div onClick={onSelect} className="cursor-pointer relative group/image">
                <div className="aspect-video w-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {project.coverImage ? (
                        <img src={project.coverImage} alt={`${project.title} cover`} className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-105" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Photograph className="w-12 h-12 text-gray-300 dark:text-gray-700" />
                        </div>
                    )}
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors" />
            </div>
            
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project.id);
                }}
                className="absolute top-2 right-2 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 focus:opacity-100 transition-all duration-200 z-10"
                aria-label={`删除 ${project.title}`}
            >
                <Trash className="w-5 h-5" />
            </button>

            <div className="p-4 flex-grow flex flex-col">
                <h3 
                    className="font-bold text-lg text-gray-900 dark:text-white truncate mb-2 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                    onClick={onSelect}
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