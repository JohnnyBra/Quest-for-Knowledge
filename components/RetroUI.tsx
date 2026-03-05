import React from 'react';

interface BoxProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const RetroBox: React.FC<BoxProps> = ({ children, className = "", title }) => (
  <div className={`relative bg-gray-900 border-4 border-white p-4 ${className}`}>
    {title && (
      <div className="absolute -top-4 left-4 bg-gray-900 px-2 text-yellow-400 font-bold tracking-wider">
        {title}
      </div>
    )}
    {children}
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'success';
}

export const RetroButton: React.FC<ButtonProps> = ({ children, variant = 'primary', className = "", ...props }) => {
  const colors = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    success: 'bg-green-600 hover:bg-green-500 text-white',
  };

  return (
    <button 
      className={`border-2 border-white px-4 py-2 font-bold transition-transform active:scale-95 ${colors[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
