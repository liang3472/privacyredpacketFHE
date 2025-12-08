import React from 'react';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const PixelButton: React.FC<PixelButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "relative px-4 py-3 font-pixel text-xs sm:text-sm border-4 border-black transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-pixel-red text-white shadow-pixel hover:bg-pixel-darkRed",
    secondary: "bg-pixel-yellow text-black shadow-pixel hover:bg-pixel-darkYellow",
    danger: "bg-gray-800 text-white shadow-pixel hover:bg-black",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`} 
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? 'PROCESSING...' : children}
    </button>
  );
};

interface PixelCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const PixelCard: React.FC<PixelCardProps> = ({ children, className = '', title }) => {
  return (
    <div className={`bg-white border-4 border-black shadow-pixel p-6 relative ${className}`}>
      {title && (
        <div className="absolute -top-5 left-4 bg-pixel-yellow border-4 border-black px-3 py-1 shadow-sm">
          <h3 className="font-pixel text-xs font-bold text-black">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
};

interface PixelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const PixelInput: React.FC<PixelInputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-2 mb-4">
      {label && <label className="font-pixel text-xs text-gray-600">{label}</label>}
      <input 
        className={`w-full bg-white border-4 border-black p-3 font-pixel text-sm outline-none focus:bg-gray-50 ${className}`}
        {...props}
      />
    </div>
  );
};

export const PixelBadge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'bg-blue-400' }) => (
    <span className={`${color} border-2 border-black px-2 py-1 text-[10px] text-white shadow-pixel-sm inline-block`}>
        {children}
    </span>
);
