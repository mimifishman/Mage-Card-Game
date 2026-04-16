import React from "react";

export function NestedArena() {
  return (
    <div
      className="relative overflow-hidden font-sans select-none"
      style={{
        width: "390px",
        height: "844px",
        backgroundColor: "#0D2B1A",
        color: "#F8F4E9",
      }}
    >
      {/* 1. Header */}
      <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-4 z-20" style={{ borderBottom: "1px solid rgba(201, 168, 76, 0.2)", backgroundColor: "rgba(13, 43, 26, 0.9)" }}>
        <div className="flex items-center gap-2">
          <span style={{ backgroundColor: "#C9A84C", color: "#0D2B1A" }} className="text-[10px] font-bold px-2 py-0.5 rounded-sm tracking-wider">MAIN</span>
          <span className="text-xs font-bold tracking-wider opacity-80" style={{ color: "#C9A84C" }}>YOUR TURN</span>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="flex items-center gap-1"><span style={{ color: "#C8102E" }}>♥</span> 17</span>
          <span className="flex items-center gap-1"><span style={{ color: "#C9A84C" }}>⚡</span> 4</span>
          <button className="ml-2 bg-transparent text-xs opacity-60 hover:opacity-100 transition-opacity">Exit</button>
        </div>
      </div>

      <div className="absolute inset-0 pt-12 flex flex-col h-full">
        {/* 2. Opponent Panel (Slim/Compressed) */}
        <div className="w-full flex items-center justify-between px-4 py-2" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm">Morgana</span>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1"><span style={{ color: "#C8102E" }}>♥</span> 12</span>
              <span className="flex items-center gap-1"><span style={{ color: "#C9A84C" }}>⚡</span> ?</span>
              <span className="flex items-center gap-1 opacity-70">Hand: 3</span>
            </div>
          </div>
          {/* Opponent Court Tiny Thumbnails */}
          <div className="flex gap-1">
            <div className="w-6 h-8 rounded-sm flex items-center justify-center text-xs font-bold shadow-sm" style={{ backgroundColor: "#F8F4E9", color: "#1B5E20" }}>
              Q♠
            </div>
          </div>
        </div>

        {/* 3. Mine / Abyss / Deck (River) */}
        <div className="flex-none px-4 py-4 mt-2">
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg border" style={{ borderColor: "rgba(201, 168, 76, 0.15)", backgroundColor: "rgba(0,0,0,0.15)" }}>
            
            {/* Mine */}
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-60" style={{ color: "#C9A84C" }}>Mine</span>
              <div className="flex gap-1">
                <div className="w-10 h-14 rounded shadow-md flex items-center justify-center text-sm font-bold relative" style={{ backgroundColor: "#F8F4E9", color: "#1B5E20" }}>
                  5♣
                </div>
                <div className="w-10 h-14 rounded shadow-md flex items-center justify-center text-sm font-bold relative" style={{ backgroundColor: "#F8F4E9", color: "#C8102E" }}>
                  3♦
                </div>
              </div>
            </div>

            {/* Abyss */}
            <div className="flex-1 flex flex-col items-center gap-1 border-x" style={{ borderColor: "rgba(201, 168, 76, 0.15)" }}>
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-60" style={{ color: "#C9A84C" }}>Abyss</span>
              <div className="w-10 h-14 rounded shadow-md flex items-center justify-center text-sm font-bold opacity-50 grayscale" style={{ backgroundColor: "#F8F4E9", color: "#1B5E20" }}>
                10♠
              </div>
            </div>

            {/* Deck */}
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-60" style={{ color: "#C9A84C" }}>Deck</span>
              <div className="w-10 h-14 rounded shadow-md flex items-center justify-center border-2 border-dashed relative" style={{ borderColor: "#C9A84C", backgroundColor: "transparent" }}>
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "#C9A84C", color: "#0D2B1A" }}>24</span>
              </div>
            </div>

          </div>
        </div>

        {/* 4. Your Court (Hero Zone) */}
        <div className="flex-1 flex flex-col items-center justify-center relative px-4">
          
          {/* Subtle concentric rings background to emphasize "arena center" */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-64 h-64 rounded-full border border-dashed" style={{ borderColor: "#C9A84C" }}></div>
            <div className="absolute w-48 h-48 rounded-full border border-dotted" style={{ borderColor: "#C9A84C" }}></div>
          </div>

          <div className="relative flex justify-center gap-6 z-10 w-full perspective-1000">
            
            {/* Royal 1 */}
            <div className="relative group">
              <div className="w-32 h-48 rounded-xl shadow-2xl flex flex-col p-2 border-2 transition-transform transform hover:scale-105" style={{ backgroundColor: "#F8F4E9", borderColor: "#C9A84C", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
                <div className="text-xl font-bold flex justify-between w-full" style={{ color: "#C8102E" }}>
                  <span>K</span>
                  <span>♥</span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-6xl opacity-20" style={{ color: "#C8102E" }}>♥</span>
                </div>
                <div className="text-xl font-bold flex justify-between w-full rotate-180" style={{ color: "#C8102E" }}>
                  <span>K</span>
                  <span>♥</span>
                </div>
              </div>
              
              {/* Floating Stat Badges */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 bg-[#0D2B1A] p-1 rounded-full border" style={{ borderColor: "#C9A84C" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#F8F4E9", color: "#1B5E20" }}>⚔3</div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#F8F4E9", color: "#C8102E" }}>♥3</div>
              </div>
            </div>

            {/* Royal 2 */}
            <div className="relative group">
              <div className="w-32 h-48 rounded-xl shadow-2xl flex flex-col p-2 border-2 transition-transform transform hover:scale-105" style={{ backgroundColor: "#F8F4E9", borderColor: "rgba(201, 168, 76, 0.4)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
                <div className="text-xl font-bold flex justify-between w-full" style={{ color: "#C8102E" }}>
                  <span>J</span>
                  <span>♦</span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-6xl opacity-20" style={{ color: "#C8102E" }}>♦</span>
                </div>
                <div className="text-xl font-bold flex justify-between w-full rotate-180" style={{ color: "#C8102E" }}>
                  <span>J</span>
                  <span>♦</span>
                </div>
              </div>
              
              {/* Floating Stat Badges */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 bg-[#0D2B1A] p-1 rounded-full border" style={{ borderColor: "rgba(201, 168, 76, 0.4)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#F8F4E9", color: "#1B5E20" }}>⚔1</div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#F8F4E9", color: "#C8102E" }}>♥1</div>
              </div>
            </div>

          </div>
        </div>

        {/* 5. Action Buttons (Below Court) */}
        <div className="px-6 py-4 z-20">
          <button className="w-full py-4 rounded-full font-bold text-lg tracking-widest uppercase shadow-lg relative overflow-hidden flex items-center justify-center gap-2 transition-transform active:scale-95" 
            style={{ backgroundColor: "#C9A84C", color: "#0D2B1A" }}>
            <span>End Turn</span>
            <div className="absolute right-2 px-3 py-1 rounded-full text-xs font-black animate-pulse shadow-sm" style={{ backgroundColor: "#C8102E", color: "#F8F4E9" }}>
              ATTACK!
            </div>
          </button>
        </div>

      </div>

      {/* 6. Hand Tray (Peek / Drawer style) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 transform translate-y-16">
        <div className="w-full flex flex-col items-center">
          {/* Drawer handle indicator */}
          <div className="w-12 h-1 rounded-full mb-2 opacity-30" style={{ backgroundColor: "#F8F4E9" }}></div>
          
          <div className="w-full flex justify-center px-2 -mx-2">
            {/* Hand Cards */}
            {[
              { rank: '7', suit: '♣', color: '#1B5E20', rot: -8, y: 12 },
              { rank: 'A', suit: '♦', color: '#C8102E', rot: -4, y: 4 },
              { rank: '3', suit: '♠', color: '#1B5E20', rot: 0, y: 0, active: true },
              { rank: '9', suit: '♥', color: '#C8102E', rot: 4, y: 4 },
              { rank: '2', suit: '♣', color: '#1B5E20', rot: 8, y: 12 },
            ].map((card, i) => (
              <div 
                key={i}
                className={`w-20 h-32 rounded-t-xl shadow-xl flex flex-col p-2 border-t border-x relative -ml-4 first:ml-0 transition-transform ${card.active ? '-translate-y-8 z-10 border-b' : 'hover:-translate-y-4'}`}
                style={{ 
                  backgroundColor: "#F8F4E9", 
                  color: card.color,
                  borderColor: card.active ? "#C9A84C" : "rgba(0,0,0,0.1)",
                  transform: `rotate(${card.rot}deg) translateY(${card.active ? -16 : card.y}px)`,
                  transformOrigin: 'bottom center',
                  zIndex: card.active ? 10 : i,
                  boxShadow: card.active ? "0 0 20px rgba(201, 168, 76, 0.4)" : "0 -4px 10px rgba(0,0,0,0.3)"
                }}
              >
                <div className="text-lg font-bold leading-none">{card.rank}</div>
                <div className="text-xl leading-none mt-1">{card.suit}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Tray background gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(13, 43, 26, 1), transparent)" }}></div>
      </div>
    </div>
  );
}
