import React from "react";
import { Heart, Zap, Sword, Shield, Feather, BookOpen, Star } from "lucide-react";

// Pre-loaded font from instructions
const fontSerif = "font-['Cormorant_Garamond']";

export function ArcaneManuscript() {
  return (
    <div
      className={`relative w-[390px] h-[844px] overflow-hidden bg-[#F2E8D0] text-[#1A2E1A] ${fontSerif} select-none`}
      style={{
        backgroundImage: 'url("/__mockup/images/parchment-bg.png")',
        backgroundSize: "cover",
        backgroundBlendMode: "multiply",
      }}
    >
      {/* Decorative Border */}
      <div className="absolute inset-2 border-[1px] border-[#B8942A]/50 pointer-events-none" />
      <div className="absolute inset-3 border-[2px] border-[#1A2E1A]/20 pointer-events-none" />

      {/* HEADER */}
      <header className="relative px-6 pt-10 pb-4 flex justify-between items-end border-b-[1px] border-[#1A2E1A]/30">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.2em] text-[#6B1E2A] font-bold">
            Chapter IV
          </span>
          <span className="text-xl tracking-wider text-[#1A2E1A] font-semibold italic">
            Main Phase
          </span>
        </div>
        <div className="flex gap-4 items-center text-lg">
          <div className="flex items-center gap-1 text-[#6B1E2A]">
            <Heart size={16} className="fill-current" />
            <span>20</span>
          </div>
          <div className="flex items-center gap-1 text-[#B8942A]">
            <Zap size={16} className="fill-current" />
            <span>5</span>
          </div>
        </div>
      </header>

      {/* OPPONENTS */}
      <section className="px-6 py-4 flex flex-col gap-4 border-b-[1px] border-[#1A2E1A]/20">
        {/* Opponent 1 */}
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-lg font-semibold italic">Lord Dorian</span>
            <div className="flex gap-3 text-sm text-[#6B1E2A]/80">
              <span className="flex items-center gap-1"><Heart size={12} className="fill-current" /> 18</span>
              <span className="flex items-center gap-1 text-[#B8942A]/80"><Zap size={12} className="fill-current" /> 3</span>
            </div>
          </div>
          <div className="flex gap-2">
            <MiniCard rank="K" suit="♠" />
            <MiniCard rank="J" suit="♦" />
          </div>
        </div>
        {/* Opponent 2 */}
        <div className="flex justify-between items-center opacity-70">
          <div className="flex flex-col">
            <span className="text-lg font-semibold italic">Lady Seraphina</span>
            <div className="flex gap-3 text-sm text-[#6B1E2A]/80">
              <span className="flex items-center gap-1"><Heart size={12} className="fill-current" /> 14</span>
              <span className="flex items-center gap-1 text-[#B8942A]/80"><Zap size={12} className="fill-current" /> 1</span>
            </div>
          </div>
          <div className="flex gap-2">
            <MiniCard rank="Q" suit="♥" />
          </div>
        </div>
      </section>

      {/* MINE / ABYSS */}
      <section className="px-8 py-6 flex justify-between items-center relative">
        {/* Decorative divider line */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-[1px] bg-[#B8942A]/40" />
        
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-20 rounded shadow-md border-[1px] border-[#1A2E1A]/80 overflow-hidden relative">
            <img src="/__mockup/images/antique-card-back.png" alt="Mine" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/20" />
          </div>
          <div className="text-center">
            <span className="block text-sm font-bold tracking-widest text-[#1A2E1A]">MINE</span>
            <span className="text-xs text-[#1A2E1A]/60 italic">28 pages</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-20 rounded shadow-md border-[1px] border-[#1A2E1A]/40 bg-[#1A2E1A]/10 flex items-center justify-center">
            <BookOpen size={20} className="text-[#1A2E1A]/40" />
          </div>
          <div className="text-center">
            <span className="block text-sm font-bold tracking-widest text-[#6B1E2A]">ABYSS</span>
            <span className="text-xs text-[#6B1E2A]/60 italic">6 pages</span>
          </div>
        </div>
      </section>

      {/* MY COURT */}
      <section className="flex-1 flex flex-col items-center justify-center pb-24 relative">
        <h3 className="absolute top-0 text-center text-sm tracking-[0.3em] text-[#1A2E1A]/50 font-bold w-full">
          ~ THY COURT ~
        </h3>
        
        <div className="flex justify-center gap-4 mt-8">
          <CourtCard rank="K" suit="♠" name="The Black King" type="royal" />
          <CourtCard rank="Q" suit="♦" name="The Ruby Queen" type="royal" />
        </div>
      </section>

      {/* ACTION BUTTONS */}
      <div className="absolute bottom-[240px] right-6 z-20 flex flex-col gap-3">
        <button className="relative w-16 h-16 flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
          <img src="/__mockup/images/wax-seal-btn.png" alt="Seal" className="absolute inset-0 w-full h-full object-contain drop-shadow-lg" />
          <span className="relative z-10 text-[#F2E8D0] text-xs font-bold tracking-widest drop-shadow-md">STRIKE</span>
        </button>
        <button className="px-4 py-2 bg-[#1A2E1A] text-[#F2E8D0] border-[1px] border-[#B8942A] rounded-[2px] text-xs tracking-[0.2em] shadow-lg shadow-black/20 hover:bg-[#1A2E1A]/90 active:scale-95 transition-all">
          END TURN
        </button>
      </div>

      {/* HAND TRAY */}
      <section className="absolute bottom-0 left-0 right-0 h-56 pt-10 px-4 bg-gradient-to-t from-[#1A2E1A]/90 to-transparent flex justify-center items-end pb-8 gap-[-20px]">
        <HandCard rank="J" suit="♠" rotate="-10deg" translateY="10px" zIndex={1} />
        <HandCard rank="7" suit="♥" rotate="-5deg" translateY="0px" zIndex={2} />
        <HandCard rank="Q" suit="♦" rotate="0deg" translateY="-5px" zIndex={3} isActive />
        <HandCard rank="8" suit="♣" rotate="5deg" translateY="0px" zIndex={4} />
        <HandCard rank="3" suit="♦" rotate="10deg" translateY="10px" zIndex={5} />
      </section>
    </div>
  );
}

// Subcomponents

function MiniCard({ rank, suit }: { rank: string; suit: string }) {
  const isRed = suit === "♥" || suit === "♦";
  return (
    <div className={`w-8 h-12 bg-[#F2E8D0] border-[1px] border-[#1A2E1A]/40 rounded-[2px] flex flex-col items-center justify-center shadow-sm ${isRed ? 'text-[#6B1E2A]' : 'text-[#1A2E1A]'}`}>
      <span className="text-sm font-bold">{rank}</span>
      <span className="text-xs">{suit}</span>
    </div>
  );
}

function CourtCard({ rank, suit, name, type }: { rank: string; suit: string; name: string; type: string }) {
  const isRed = suit === "♥" || suit === "♦";
  return (
    <div className="w-28 h-40 bg-[#F2E8D0] border-[1px] border-[#B8942A] rounded-[3px] shadow-lg flex flex-col relative overflow-hidden group hover:-translate-y-2 transition-transform cursor-pointer">
      <div className="absolute inset-1 border-[1px] border-[#1A2E1A]/10 pointer-events-none" />
      
      {/* Card Header */}
      <div className={`px-2 py-1 flex justify-between items-start ${isRed ? 'text-[#6B1E2A]' : 'text-[#1A2E1A]'}`}>
        <div className="flex flex-col items-center">
          <span className="text-xl font-bold leading-none">{rank}</span>
          <span className="text-lg leading-none">{suit}</span>
        </div>
      </div>

      {/* Card Art Area */}
      <div className="flex-1 mx-2 mb-2 mt-1 border-[1px] border-[#1A2E1A]/20 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-[#1A2E1A] to-transparent" />
        <Feather size={32} className="text-[#1A2E1A]/40 mb-2" />
        <span className="text-center text-[10px] uppercase tracking-widest font-bold text-[#1A2E1A]/60 px-1 italic">
          {name}
        </span>
      </div>
    </div>
  );
}

function HandCard({ rank, suit, rotate, translateY, zIndex, isActive }: { rank: string; suit: string; rotate: string; translateY: string; zIndex: number; isActive?: boolean }) {
  const isRed = suit === "♥" || suit === "♦";
  
  return (
    <div 
      className={`relative w-24 h-36 bg-[#F2E8D0] border-[1px] border-[#1A2E1A]/80 rounded-[4px] shadow-2xl flex flex-col transition-transform duration-300 hover:-translate-y-6 cursor-pointer ${isActive ? '-translate-y-4 ring-2 ring-[#B8942A] ring-offset-2 ring-offset-[#1A2E1A]/50' : ''}`}
      style={{ 
        transform: `rotate(${rotate}) translateY(${translateY})`,
        zIndex,
        marginLeft: '-25px', // Overlap
        marginRight: '-25px'
      }}
    >
      <div className="absolute inset-1 border-[1px] border-[#1A2E1A]/10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-black/10 to-transparent pointer-events-none rounded-tr-[3px]" />
      
      <div className={`p-2 flex flex-col ${isRed ? 'text-[#6B1E2A]' : 'text-[#1A2E1A]'}`}>
        <span className="text-2xl font-bold leading-none drop-shadow-sm">{rank}</span>
        <span className="text-xl leading-none drop-shadow-sm">{suit}</span>
      </div>

      <div className="flex-1 flex items-center justify-center opacity-20">
        <span className={`text-6xl ${isRed ? 'text-[#6B1E2A]' : 'text-[#1A2E1A]'}`}>{suit}</span>
      </div>
    </div>
  );
}
