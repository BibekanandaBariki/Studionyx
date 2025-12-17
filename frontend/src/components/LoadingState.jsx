const LoadingState = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="h-4 rounded-full bg-slate-700/60 animate-pulse" />
      ))}
    </div>
  );
};

export default LoadingState;



