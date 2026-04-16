import React from "react";

export function DuelSplit() {
  return (
    <div
      className="relative w-full overflow-hidden font-sans text-white select-none"
      style={{
        width: "390px",
        height: "844px",
        backgroundColor: "#0D2B1A",
      }}
    >
      {/* 1. Header (Slim overlay) */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-sm border-b border-[#C9A84C]/30">
        <div className="flex items-center gap-3">
          <div className="px-2 py-0.5 text-xs font-bold tracking-wider text-[#0D2B1A] bg-[#C9A84C] rounded-sm">
            MAIN
          </div>
          <div className="text-sm font-semibold tracking-wide text-white/90">
            YOUR TURN
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="flex items-center gap-1">
            <span style={{ color: "#C8102E" }}>♥</span> 17
          </div>
          <div className="flex items-center gap-1 text-[#C9A84C]">
            <span>⚡</span> 4
          </div>
          <button className="px-2 py-1 text-xs font-bold border rounded border-[#C8102E]/60 text-[#C8102E] bg-black/20">
            RESIGN
          </button>
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="flex flex-col h-full pt-10">
        {/* 2. Top Half: Opponent's Zone (Rotated) */}
        <div className="flex flex-col flex-1 pb-4 relative">
          {/* Opponent Info - Placed at the "bottom" (visually top) of their zone */}
          <div className="flex items-center justify-between px-4 mt-2">
            <div className="flex items-center gap-3 opacity-80">
              <div className="w-8 h-8 rounded-full bg-[#1B5E20] border border-[#C9A84C]/50 flex items-center justify-center text-xs font-bold">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#C9A84C]">Morgana</span>
                <span className="text-xs text-white/60">3 Cards in Hand</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm opacity-80">
              <div className="flex items-center gap-1">
                <span style={{ color: "#C8102E" }}>♥</span> 12
              </div>
              <div className="flex items-center gap-1 text-[#C9A84C]">
                <span>⚡</span> 2
              </div>
            </div>
          </div>

          {/* Opponent Court */}
          <div className="flex items-center justify-center flex-1 rotate-180 mt-4">
            {/* Card: Q♠ */}
            <div className="relative">
              <div
                className="flex flex-col items-center justify-center w-24 h-36 rounded-lg shadow-xl"
                style={{ backgroundColor: "#F8F4E9" }}
              >
                <div className="absolute top-2 left-2 text-lg font-bold leading-none" style={{ color: "#1B5E20" }}>
                  Q<br />♠
                </div>
                <div className="text-4xl" style={{ color: "#1B5E20" }}>♠</div>
                <div className="absolute bottom-2 right-2 text-lg font-bold leading-none rotate-180" style={{ color: "#1B5E20" }}>
                  Q<br />♠
                </div>
              </div>
              {/* Stat Badges for Opponent */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 rotate-180">
                <div className="px-1.5 py-0.5 text-[10px] font-bold bg-black/80 text-white rounded-full flex items-center gap-1 border border-white/20">
                  <span>⚔</span> 2
                </div>
                <div className="px-1.5 py-0.5 text-[10px] font-bold bg-[#C8102E] text-white rounded-full flex items-center gap-1 border border-white/20">
                  <span>♥</span> 2
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Center Divider: Mine/Abyss/Deck */}
        <div className="flex items-center justify-between w-full px-6 py-3 bg-black/60 border-y-2 border-[#C9A84C]">
          {/* Deck */}
          <div className="flex flex-col items-center gap-1">
            <div
              className="relative w-12 h-16 rounded shadow-md border border-[#C9A84C]/50 flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: "#1B5E20" }}
            >
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, #C9A84C 2px, #C9A84C 4px)" }}></div>
              <div className="w-8 h-8 rounded-full border border-[#C9A84C]/50 flex items-center justify-center bg-black/40 z-10">
                <span className="text-xs font-bold text-[#C9A84C]">24</span>
              </div>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-[#C9A84C]/70 uppercase">Deck</span>
          </div>

          {/* Mine */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-2">
              <div
                className="w-12 h-16 rounded shadow-md flex items-center justify-center flex-col"
                style={{ backgroundColor: "#F8F4E9", color: "#1B5E20" }}
              >
                <span className="text-sm font-bold">5</span>
                <span className="text-lg leading-none">♣</span>
              </div>
              <div
                className="w-12 h-16 rounded shadow-md flex items-center justify-center flex-col"
                style={{ backgroundColor: "#F8F4E9", color: "#C8102E" }}
              >
                <span className="text-sm font-bold">3</span>
                <span className="text-lg leading-none">♦</span>
              </div>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-[#C9A84C]/70 uppercase">The Mine</span>
          </div>

          {/* Abyss */}
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-12 h-16 rounded shadow-md flex items-center justify-center flex-col opacity-60 grayscale"
              style={{ backgroundColor: "#F8F4E9", color: "#1B5E20" }}
            >
              <span className="text-sm font-bold">10</span>
              <span className="text-lg leading-none">♠</span>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-[#C9A84C]/70 uppercase">Abyss</span>
          </div>
        </div>

        {/* 4. Bottom Half: Your Zone */}
        <div className="flex flex-col flex-1 pt-4 pb-2 relative">
          
          {/* Your Court */}
          <div className="flex items-center justify-center gap-6 flex-1">
            {/* Card 1: K♥ */}
            <div className="relative transform hover:-translate-y-2 transition-transform">
              <div
                className="flex flex-col items-center justify-center w-28 h-40 rounded-lg shadow-xl border-2 border-[#C9A84C]"
                style={{ backgroundColor: "#F8F4E9" }}
              >
                <div className="absolute top-2 left-2 text-xl font-bold leading-none" style={{ color: "#C8102E" }}>
                  K<br />♥
                </div>
                <div className="text-5xl" style={{ color: "#C8102E" }}>♥</div>
                <div className="absolute bottom-2 right-2 text-xl font-bold leading-none rotate-180" style={{ color: "#C8102E" }}>
                  K<br />♥
                </div>
              </div>
              {/* Stat Badges */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                <div className="px-2 py-0.5 text-xs font-bold bg-black/90 text-white rounded-full flex items-center gap-1 border-2 border-[#C9A84C]">
                  <span>⚔</span> 3
                </div>
                <div className="px-2 py-0.5 text-xs font-bold bg-[#C8102E] text-white rounded-full flex items-center gap-1 border-2 border-white/80">
                  <span>♥</span> 3
                </div>
              </div>
            </div>

            {/* Card 2: J♦ */}
            <div className="relative transform hover:-translate-y-2 transition-transform">
              <div
                className="flex flex-col items-center justify-center w-28 h-40 rounded-lg shadow-xl"
                style={{ backgroundColor: "#F8F4E9" }}
              >
                <div className="absolute top-2 left-2 text-xl font-bold leading-none" style={{ color: "#C8102E" }}>
                  J<br />♦
                </div>
                <div className="text-5xl" style={{ color: "#C8102E" }}>♦</div>
                <div className="absolute bottom-2 right-2 text-xl font-bold leading-none rotate-180" style={{ color: "#C8102E" }}>
                  J<br />♦
                </div>
              </div>
              {/* Stat Badges */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                <div className="px-2 py-0.5 text-xs font-bold bg-black/90 text-white rounded-full flex items-center gap-1 border border-white/20">
                  <span>⚔</span> 1
                </div>
                <div className="px-2 py-0.5 text-xs font-bold bg-[#C8102E] text-white rounded-full flex items-center gap-1 border border-white/20">
                  <span>♥</span> 1
                </div>
              </div>
            </div>
          </div>

          {/* 5. Action Buttons */}
          <div className="flex justify-center gap-4 mt-8 mb-2 z-20">
            <button className="px-6 py-3 font-bold text-white tracking-widest uppercase rounded bg-[#C8102E] shadow-[0_4px_0_#7a0a1c] active:translate-y-1 active:shadow-none transition-all">
              Attack!
            </button>
            <button className="px-6 py-3 font-bold tracking-widest uppercase rounded border border-[#C9A84C] text-[#C9A84C] bg-black/40 hover:bg-black/60 transition-colors">
              End Turn
            </button>
          </div>
        </div>

        {/* 6. Hand Tray */}
        <div className="h-28 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center px-4 pb-4">
          <div className="flex items-end justify-center -space-x-8">
            {/* Hand Cards */}
            {[
              { rank: "7", suit: "♣", color: "#1B5E20", rotate: "-12deg", z: 1 },
              { rank: "A", suit: "♦", color: "#C8102E", rotate: "-6deg", z: 2 },
              { rank: "3", suit: "♠", color: "#1B5E20", rotate: "0deg", z: 3, elevate: true },
              { rank: "9", suit: "♥", color: "#C8102E", rotate: "6deg", z: 4 },
              { rank: "2", suit: "♣", color: "#1B5E20", rotate: "12deg", z: 5 },
            ].map((card, i) => (
              <div
                key={i}
                className={`w-20 h-28 rounded shadow-2xl transition-transform hover:-translate-y-6 cursor-pointer ${card.elevate ? '-translate-y-3' : ''}`}
                style={{
                  backgroundColor: "#F8F4E9",
                  transform: `rotate(${card.rotate}) ${card.elevate ? 'translateY(-12px)' : ''}`,
                  zIndex: card.z,
                  boxShadow: "-4px 0 12px rgba(0,0,0,0.5)"
                }}
              >
                <div className="p-1.5 flex flex-col items-center">
                  <span className="text-sm font-bold leading-none" style={{ color: card.color }}>{card.rank}</span>
                  <span className="text-sm leading-none" style={{ color: card.color }}>{card.suit}</span>
                </div>
                <div className="flex-1 flex items-center justify-center h-full pb-8">
                  <span className="text-2xl" style={{ color: card.color }}>{card.suit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
