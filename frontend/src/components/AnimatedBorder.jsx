const AnimatedBorder = ({ children, className = '' }) => {
  return (
    <div className={`relative group ${className}`}>
      <div className="absolute -inset-[2px] rounded-2xl bg-[linear-gradient(120deg,#10b981,#14b8a6,#06b6d4,#10b981)] bg-[length:200%_200%] opacity-40 group-hover:opacity-100 blur group-hover:blur-md transition-all duration-700 animate-gradient-xy" />
      <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 group-hover:bg-slate-900/80 transition-colors duration-300">
        {children}
      </div>
    </div>
  );
};

export default AnimatedBorder;


