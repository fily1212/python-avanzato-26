export default function PlayerCard({ player, selected, onClick, isMe, badge, badgeColor, showRole, roleName, lightMode = false }) {
  const alive = player.is_alive;

  const getBadgeClasses = () => {
    switch (badgeColor) {
      case 'wolf': return 'bg-red-700 text-white';
      case 'safe': return 'bg-green-600 text-white';
      case 'info': return 'bg-purple-600 text-white';
      case 'danger': return 'bg-red-600 text-white animate-pulse';
      case 'warning': return 'bg-amber-500 text-white';
      default: return lightMode ? 'bg-red-600 text-white' : 'bg-[var(--accent)] text-white';
    }
  };

  if (lightMode) {
    // DAY theme - light colors
    return (
      <button
        onClick={alive && !isMe ? onClick : undefined}
        disabled={!alive || isMe}
        className={`
          relative flex flex-col items-center justify-center
          w-28 h-36 rounded-2xl border-2 transition-all duration-200 cursor-pointer
          ${!alive
            ? 'opacity-30 border-gray-400 bg-gray-300/40 cursor-not-allowed grayscale'
            : selected
              ? 'border-red-600 bg-red-100 shadow-lg shadow-red-400/40 scale-105 text-gray-900'
              : isMe
                ? 'border-emerald-600 bg-emerald-100 cursor-default text-emerald-900'
                : 'border-blue-400 bg-blue-50 hover:border-blue-600 hover:bg-blue-100 hover:scale-105 text-gray-900'
          }
        `}
      >
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl mb-1.5
          ${alive ? 'bg-white border border-gray-400' : 'bg-gray-200 border border-gray-400'}`}>
          {alive ? '🎭' : '💀'}
        </div>

        <span className={`text-xs font-bold truncate w-full text-center px-1
          ${isMe ? 'text-emerald-700' : !alive ? 'text-gray-500' : 'text-gray-900'}`}>
          {player.nickname}
          {isMe && ' (Tu)'}
        </span>

        {showRole && roleName && (
          <span className="text-[10px] text-amber-700 mt-0.5">{roleName}</span>
        )}

        {badge && (
          <span className={`absolute -top-2 -right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md ${getBadgeClasses()}`}>
            {badge}
          </span>
        )}
      </button>
    );
  }

  // NIGHT theme - dark colors
  return (
    <button
      onClick={alive && !isMe ? onClick : undefined}
      disabled={!alive || isMe}
      className={`
        relative flex flex-col items-center justify-center
        w-28 h-36 rounded-2xl border-2 transition-all duration-200 cursor-pointer
        ${!alive
          ? 'opacity-40 border-gray-700 bg-gray-900/70 cursor-not-allowed grayscale'
          : selected
            ? 'border-[var(--accent)] bg-[var(--accent)]/20 shadow-lg shadow-[var(--accent)]/30 scale-105 text-white'
            : isMe
              ? 'border-emerald-500 bg-emerald-900/40 cursor-default text-emerald-100'
              : 'border-gray-600 bg-gray-800/60 hover:border-gray-400 hover:bg-gray-700/60 hover:scale-105 text-gray-100'
        }
      `}
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl mb-1.5
        ${alive ? 'bg-gray-900/80 border border-gray-600' : 'bg-gray-950 border border-gray-700'}`}>
        {alive ? '🎭' : '💀'}
      </div>

      <span className={`text-xs font-bold truncate w-full text-center px-1
        ${isMe ? 'text-emerald-300' : !alive ? 'text-gray-500' : 'text-white'}`}>
        {player.nickname}
        {isMe && ' (Tu)'}
      </span>

      {showRole && roleName && (
        <span className="text-[10px] text-[var(--gold)] mt-0.5">{roleName}</span>
      )}

      {badge && (
        <span className={`absolute -top-2 -right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md ${getBadgeClasses()}`}>
          {badge}
        </span>
      )}
    </button>
  );
}
