import React from 'react';

// FIX: Cannot find namespace 'JSX'. Changed to React.ReactElement.
export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactElement, size?: 'sm' | 'md' }> = ({ children, icon, className, size = 'md', ...props }) => {
    const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2';
    return (
      <button
        {...props}
        className={`inline-flex items-center justify-center gap-2 ${sizeClasses} bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {icon}{children}
      </button>
    );
};

// FIX: Cannot find namespace 'JSX'. Changed to React.ReactElement.
export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactElement, size?: 'sm' | 'md' }> = ({ children, icon, className, size = 'md', ...props }) => {
    const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2';
    return (
      <button
        {...props}
        className={`inline-flex items-center justify-center gap-2 ${sizeClasses} bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-md border border-slate-300 shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {icon}{children}
      </button>
    );
};

// FIX: Cannot find namespace 'JSX'. Changed to React.ReactElement.
export const DangerButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactElement, size?: 'sm' | 'md' }> = ({ children, icon, className, size = 'sm', ...props }) => {
    const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2';
    return (
      <button
        {...props}
        className={`inline-flex items-center justify-center gap-2 ${sizeClasses} bg-red-500 hover:bg-red-600 text-white font-medium rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {icon}{children}
      </button>
    );
};

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode, "aria-label": string, title?: string }> = ({ children, className, title, ...props }) => (
  <button
    {...props}
    title={title}
    className={`p-1.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-sky-600 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 flex items-center justify-center disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);