import React from 'react';
import { Heart, Zap, Cpu } from 'lucide-react';

export function VoidNeon() {
  // Data
  const opponent = { name: "SYS.DORIAN", life: 18, vault: 2 };
  const player = { name: "USR.LYRA", life: 20, vault: 5 };
  const mineCount = 28;
  const abyssCount = 6;

  const oppCourt = [
    { id: 1, rank: 'K', suit: '♠' },
    { id: 2, rank: 'Q', suit: '♣' }
  ];

  const myCourt = [
    { id: 3, rank: 'K', suit: '♥' },
    { id: 4, rank: 'J', suit: '♦' },
    { id: 5, rank: 'A', suit: '♠' }
  ];

  const hand = [
    { id: 6, rank: 'J', suit: '♠' },
    { id: 7, rank: '7', suit: '♥' },
    { id: 8, rank: 'Q', suit: '♦' },
    { id: 9, rank: '8', suit: '♣' },
    { id: 10, rank: '3', suit: '♦' }
  ];

  return (
    <div style={{ width: 390, height: 844 }} className="bg-[#060608] font-mono text-[#00E5FF] overflow-hidden flex flex-col relative uppercase tracking-wider select-none border border-[#00E5FF]/20">
      
      {/* CRT Overlay Effect */}
      <div className="absolute inset-0 pointer-events-none z-50 opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />

      {/* Header */}
      <header className="flex justify-between items-center p-3 border-b border-[#FF0090] bg-[#0D0D18] shadow-[0_2px_10px_rgba(255,0,144,0.2)]">
        <div className="flex flex-col">
          <span className="text-[10px] text-[#FF0090]">T-04</span>
          <span className="text-sm font-bold drop-shadow-[0_0_5px_#00E5FF]">MAIN_PHASE</span>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1 text-white">
            <Heart size={14} className="text-[#FF0090] drop-shadow-[0_0_5px_#FF0090]" />
            <span className="drop-shadow-[0_0_5px_white]">{player.life}</span>
          </div>
          <div className="flex items-center gap-1 text-white">
            <Zap size={14} className="text-[#00E5FF] drop-shadow-[0_0_5px_#00E5FF]" />
            <span className="drop-shadow-[0_0_5px_white]">{player.vault}</span>
          </div>
        </div>
      </header>

      {/* Opponent Zone */}
      <div className="p-4 border-b border-[#00E5FF]/30 bg-[linear-gradient(180deg,rgba(13,13,24,0.8)_0%,rgba(6,6,8,1)_100%)] h-[140px] flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-[#FF0090]" />
            <span className="text-sm text-white drop-shadow-[0_0_2px_white]">{opponent.name}</span>
          </div>
          <div className="flex gap-3 text-xs opacity-80">
            <span className="flex items-center gap-1"><Heart size={12} className="text-[#FF0090]"/>{opponent.life}</span>
            <span className="flex items-center gap-1"><Zap size={12} className="text-[#00E5FF]"/>{opponent.vault}</span>
          </div>
        </div>
        
        <div className="flex gap-2 justify-center mt-2">
          {oppCourt.map(card => (
            <div key={card.id} className="w-12 h-16 border border-[#FF0090] bg-[#060608] flex items-center justify-center relative shadow-[0_0_5px_rgba(255,0,144,0.4)]">
               <div className="absolute top-1 left-1 text-[8px] text-[#FF0090]">{card.rank}</div>
               <div className="text-sm text-[#FF0090] drop-shadow-[0_0_2px_#FF0090]">{card.suit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mine / Abyss */}
      <div className="flex justify-center gap-8 py-5 items-center border-b border-[#00E5FF]/20 relative">
        <div className="absolute top-1/2 w-full h-px bg-gradient-to-r from-transparent via-[#00E5FF]/20 to-transparent" />
        
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-20 border border-[#00E5FF] bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,229,255,0.1)_2px,rgba(0,229,255,0.1)_4px)] flex items-center justify-center shadow-[0_0_8px_rgba(0,229,255,0.3)] backdrop-blur-sm z-10">
            <span className="text-[10px] font-bold text-white bg-[#060608] px-1 border-y border-[#00E5FF]/50">MINE</span>
          </div>
          <span className="text-[10px] mt-2 text-[#00E5FF]/70">[ {mineCount} ]</span>
        </div>

        <div className="relative flex flex-col items-center">
          <div className="w-16 h-20 border border-[#FF0090] bg-[repeating-linear-gradient(-45deg,transparent,transparent_2px,rgba(255,0,144,0.1)_2px,rgba(255,0,144,0.1)_4px)] flex items-center justify-center shadow-[0_0_8px_rgba(255,0,144,0.3)] backdrop-blur-sm z-10">
            <span className="text-[10px] font-bold text-white bg-[#060608] px-1 border-y border-[#FF0090]/50">ABYSS</span>
          </div>
          <span className="text-[10px] mt-2 text-[#FF0090]/70">[ {abyssCount} ]</span>
        </div>
      </div>

      {/* My Court */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="absolute top-2 left-4 text-[10px] text-[#00E5FF]/50 border-l border-[#00E5FF]/50 pl-2">ACTIVE_PROCESSES</div>
        <div className="flex gap-4 mt-4">
          {myCourt.map(card => (
            <div key={card.id} className="w-20 h-28 border border-[#00E5FF] bg-[#0D0D18] flex flex-col justify-between p-2 shadow-[0_0_12px_rgba(0,229,255,0.2),inset_0_0_15px_rgba(0,229,255,0.1)] relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-[#00E5FF]/10 to-transparent pointer-events-none" />
              <div className="text-lg font-bold leading-none">{card.rank}</div>
              <div className="text-3xl self-center text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">{card.suit}</div>
              <div className="text-lg font-bold leading-none self-end rotate-180">{card.rank}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 flex justify-center border-t border-[#00E5FF]/20 relative">
        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-32 h-px bg-[#FF0090] shadow-[0_0_10px_#FF0090]" />
        <button className="w-full py-3 border border-[#FF0090] bg-[#FF0090]/10 text-[#FF0090] font-bold text-lg hover:bg-[#FF0090]/20 active:bg-[#FF0090]/30 transition-all duration-300 shadow-[0_0_15px_rgba(255,0,144,0.4),inset_0_0_10px_rgba(255,0,144,0.2)] animate-pulse hover:animate-none">
          EXECUTE // ATTACK
        </button>
      </div>

      {/* Hand Tray */}
      <div className="h-[180px] bg-[linear-gradient(0deg,rgba(0,229,255,0.05)_0%,rgba(6,6,8,1)_100%)] border-t border-[#00E5FF]/50 p-4 relative overflow-visible shadow-[0_-5px_20px_rgba(0,229,255,0.1)]">
         <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#060608] border border-[#00E5FF] px-3 py-1 text-[10px] tracking-widest text-[#00E5FF] shadow-[0_0_5px_rgba(0,229,255,0.3)]">
           LOCAL_BUFFER
         </div>
         
         <div className="flex justify-center h-full items-end pb-2 relative w-full">
           {hand.map((card, i) => {
             const offset = i - (hand.length - 1) / 2;
             const rotation = offset * 5;
             const translateY = Math.abs(offset) * 8;
             
             return (
               <div 
                 key={card.id}
                 className="w-16 h-24 border border-[#00E5FF] bg-[#060608] flex flex-col justify-between p-1.5 absolute shadow-[0_0_10px_rgba(0,229,255,0.3),inset_0_0_8px_rgba(0,229,255,0.1)] hover:-translate-y-6 hover:shadow-[0_0_20px_rgba(0,229,255,0.6)] hover:border-white hover:z-50 transition-all duration-300 cursor-pointer"
                 style={{
                   transform: `translateX(${offset * 35}px) translateY(${translateY}px) rotate(${rotation}deg)`,
                   zIndex: i + 10
                 }}
               >
                 <div className="text-sm font-bold leading-none">{card.rank}</div>
                 <div className="text-2xl self-center text-white drop-shadow-[0_0_5px_#00E5FF]">{card.suit}</div>
                 <div className="text-sm font-bold leading-none self-end rotate-180">{card.rank}</div>
               </div>
             );
           })}
         </div>
      </div>
      
    </div>
  );
}
