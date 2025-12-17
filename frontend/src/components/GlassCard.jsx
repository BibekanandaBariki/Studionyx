const GlassCard = ({ children, className = '', hover = true }) => {
  return (
    <div
      className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl text-coolwhite ${
        hover ? 'hover:bg-white/10 hover:-translate-y-1 transition-all duration-300' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassCard;



