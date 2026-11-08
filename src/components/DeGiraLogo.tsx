import React from 'react';

interface DeGiraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const DeGiraLogo: React.FC<DeGiraLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const imageSrc = '/icons/degira-van.jpg';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${sizeMap[size]} rounded-2xl overflow-hidden bg-slate-900 border-2 border-amber-500/50 shadow-lg shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform duration-200 relative`}
      >
        <img
          src={imageSrc}
          alt="DeGira Camioneta VW Hippie Años 60"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to stylized SVG van if image load fails
            e.currentTarget.style.display = 'none';
          }}
        />
        {/* Subtle glow border */}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-amber-400/30 pointer-events-none" />
      </div>

      {showText && (
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-lg tracking-tight text-slate-100 font-display">
              De<span className="text-amber-400">Gira</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/40 tracking-wider">
              EN VIVO
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium leading-none">
            Música & Bares de Bs. As.
          </p>
        </div>
      )}
    </div>
  );
};
