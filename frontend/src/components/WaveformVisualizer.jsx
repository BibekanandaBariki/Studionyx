const WaveformVisualizer = ({ isActive }) => {
  return (
    <div className="flex items-end justify-center space-x-1 h-16">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="w-[3px] rounded-full bg-emerald-500 transition-all duration-150"
          style={{
            height: isActive ? `${Math.random() * 60 + 10}px` : '6px',
          }}
        />
      ))}
    </div>
  );
};

export default WaveformVisualizer;



