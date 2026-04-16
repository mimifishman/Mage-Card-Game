import React from "react";

export function CommandHUD() {
  return (
    <div className="w-[390px] h-[844px] bg-[#0D2B1A] text-[#F8F4E9] font-sans overflow-hidden flex flex-col relative shadow-2xl mx-auto border border-[#C9A84C]/30">
      
      {/* 1. Header & Opponent Panel (~15% height) */}
      <div className="h-[15%] shrink-0 border-b border-[#C9A84C]/20 bg-[#0D2B1A]/80 flex flex-col p-3 z-10">
        
        {/* Game Status Header */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#C9A84C] text-[#0D2B1A] text-xs font-bold px-2 py-0.5 rounded-sm">MAIN</span>
            <span className="text-xs font-bold tracking-wider text-[#C9A84C]">YOUR TURN</span>
          </div>
          <button className="text-xs bg-[#1B5E20] border border-[#C9A84C]/50 px-2 py-1 rounded text-[#C9A84C]">
            End Game
          </button>
        </div>

        {/* Opponent Compressed Strip */}
        <div className="flex items-center justify-between bg-black/30 rounded-lg p-2 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1B5E20] border border-[#C9A84C] flex items-center justify-center font-bold text-sm">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Morgana</span>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center text-[#C8102E]">♥ 12</span>
                <span className="flex items-center text-[#C9A84C]">⚡ 0</span>
                <span className="flex items-center text-[#F8F4E9]/70">🃏 3</span>
              </div>
            </div>
          </div>
          
          {/* Opponent Court Thumbnails */}
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-12 bg-[#F8F4E9] rounded flex items-center justify-center border border-black shadow">
              <span className="text-[#1B5E20] font-bold text-sm">Q♠</span>
              <div className="absolute -bottom-1 -right-1 bg-black text-[#F8F4E9] text-[8px] px-1 rounded-full border border-[#C9A84C]">
                2/2
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Mine/Abyss/Deck Row (~12% height) */}
      <div className="h-[12%] shrink-0 flex items-center justify-center gap-6 px-4 py-2 border-b border-black/50 bg-black/20">
        {/* Mine */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-[#C9A84C] font-semibold uppercase tracking-widest">Mine</span>
          <div className="flex gap-1">
            <div className="w-10 h-14 bg-[#F8F4E9] rounded border border-black shadow-lg flex items-center justify-center">
              <span className="text-[#1B5E20] font-bold">5♣</span>
            </div>
            <div className="w-10 h-14 bg-[#F8F4E9] rounded border border-black shadow-lg flex items-center justify-center">
              <span className="text-[#C8102E] font-bold">3♦</span>
            </div>
          </div>
        </div>
        
        {/* Abyss */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-[#C9A84C] font-semibold uppercase tracking-widest">Abyss</span>
          <div className="w-10 h-14 bg-[#F8F4E9]/40 rounded border border-black/50 flex items-center justify-center grayscale">
            <span className="text-[#1B5E20]/50 font-bold">10♠</span>
          </div>
        </div>

        {/* Deck */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-[#C9A84C] font-semibold uppercase tracking-widest">Deck</span>
          <div className="w-10 h-14 bg-[#1B5E20] rounded border border-[#C9A84C] flex items-center justify-center shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')]"></div>
            <span className="text-[#C9A84C] font-bold z-10">24</span>
          </div>
        </div>
      </div>

      {/* 3. Action Buttons (~8% height) */}
      <div className="h-[8%] shrink-0 flex items-center justify-center gap-4 px-4 bg-gradient-to-b from-transparent to-black/30">
        <button className="flex-1 max-w-[140px] py-2.5 rounded border border-[#C8102E] bg-[#C8102E]/20 text-[#C8102E] font-bold uppercase tracking-wider text-sm shadow-[0_0_10px_rgba(200,16,46,0.3)]">
          Attack!
        </button>
        <button className="flex-1 max-w-[140px] py-2.5 rounded border border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C] font-bold uppercase tracking-wider text-sm">
          End Turn
        </button>
      </div>

      {/* 4. Your Court (~25% height) */}
      <div className="h-[25%] shrink-0 flex flex-col justify-center px-4 relative">
        <div className="absolute top-2 left-4 text-xs font-bold text-[#C9A84C]/70 tracking-widest uppercase">
          Your Court
        </div>
        
        <div className="flex justify-center items-center gap-6 mt-4">
          {/* K Hearts */}
          <div className="relative">
            <div className="w-20 h-28 bg-[#F8F4E9] rounded-lg border-2 border-[#C9A84C] shadow-[0_5px_15px_rgba(0,0,0,0.5)] flex flex-col">
              <div className="p-1.5 flex justify-between items-start text-[#C8102E]">
                <span className="font-bold text-lg leading-none">K</span>
                <span className="text-xl leading-none">♥</span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-[#C8102E]/20 bg-[#C8102E]/5 flex items-center justify-center">
                   <span className="text-2xl text-[#C8102E] opacity-50">♚</span>
                </div>
              </div>
            </div>
            {/* Stat Badges */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 bg-[#0D2B1A] border border-[#C9A84C] rounded-full p-1 shadow-lg">
              <div className="flex items-center justify-center px-1.5 min-w-[32px] rounded-full bg-black text-[#F8F4E9] text-xs font-bold">
                ⚔ 3
              </div>
              <div className="flex items-center justify-center px-1.5 min-w-[32px] rounded-full bg-[#C8102E] text-[#F8F4E9] text-xs font-bold">
                ♥ 3
              </div>
            </div>
          </div>

          {/* J Diamonds */}
          <div className="relative">
            <div className="w-20 h-28 bg-[#F8F4E9] rounded-lg border-2 border-black/20 shadow-[0_5px_15px_rgba(0,0,0,0.5)] flex flex-col">
              <div className="p-1.5 flex justify-between items-start text-[#C8102E]">
                <span className="font-bold text-lg leading-none">J</span>
                <span className="text-xl leading-none">♦</span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-[#C8102E]/20 bg-[#C8102E]/5 flex items-center justify-center">
                   <span className="text-2xl text-[#C8102E] opacity-50">♝</span>
                </div>
              </div>
            </div>
            {/* Stat Badges */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 bg-[#0D2B1A] border border-[#C9A84C] rounded-full p-1 shadow-lg">
              <div className="flex items-center justify-center px-1.5 min-w-[32px] rounded-full bg-black text-[#F8F4E9] text-xs font-bold">
                ⚔ 1
              </div>
              <div className="flex items-center justify-center px-1.5 min-w-[32px] rounded-full bg-[#C8102E] text-[#F8F4E9] text-xs font-bold">
                ♥ 1
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Hand Tray (~40% height) - Dominant Area */}
      <div className="h-[40%] shrink-0 bg-black/40 border-t border-[#C9A84C]/30 relative flex flex-col">
        {/* Player Stats Bar above hand */}
        <div className="flex justify-between items-center p-3 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#C9A84C] border-2 border-white flex items-center justify-center font-bold text-[#0D2B1A] shadow-[0_0_10px_rgba(201,168,76,0.5)]">
              T
            </div>
            <div>
              <div className="text-sm font-bold">Theron</div>
              <div className="text-xs text-[#F8F4E9]/60">Your Hand</div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-[#C8102E]/30">
              <span className="text-[#C8102E] text-sm">♥</span>
              <span className="font-bold text-lg leading-none">17</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-[#C9A84C]/30">
              <span className="text-[#C9A84C] text-sm">⚡</span>
              <span className="font-bold text-lg leading-none text-[#C9A84C]">4</span>
            </div>
          </div>
        </div>

        {/* The Fan/Row of Cards */}
        <div className="flex-1 flex justify-center items-end pb-8 px-2 overflow-visible">
          <div className="flex justify-center -space-x-8 w-full max-w-[360px]">
            {/* 7♣ */}
            <div className="w-24 h-36 bg-[#F8F4E9] rounded-xl border border-black shadow-[0_0_20px_rgba(0,0,0,0.8)] flex flex-col transform -rotate-6 origin-bottom-right hover:-translate-y-4 hover:z-50 transition-transform cursor-pointer">
              <div className="p-2 flex flex-col text-[#1B5E20]">
                <span className="font-bold text-xl leading-none">7</span>
                <span className="text-xl leading-none">♣</span>
              </div>
            </div>
            
            {/* A♦ */}
            <div className="w-24 h-36 bg-[#F8F4E9] rounded-xl border border-black shadow-[0_0_20px_rgba(0,0,0,0.8)] flex flex-col transform -rotate-3 origin-bottom hover:-translate-y-4 hover:z-50 transition-transform cursor-pointer z-10">
              <div className="p-2 flex flex-col text-[#C8102E]">
                <span className="font-bold text-xl leading-none">A</span>
                <span className="text-xl leading-none">♦</span>
              </div>
            </div>

            {/* 3♠ */}
            <div className="w-24 h-36 bg-[#F8F4E9] rounded-xl border-2 border-[#C9A84C] shadow-[0_0_20px_rgba(201,168,76,0.3)] flex flex-col transform origin-bottom hover:-translate-y-4 hover:z-50 transition-transform cursor-pointer z-20 -translate-y-2">
              <div className="p-2 flex flex-col text-[#1B5E20]">
                <span className="font-bold text-xl leading-none">3</span>
                <span className="text-xl leading-none">♠</span>
              </div>
            </div>

            {/* 9♥ */}
            <div className="w-24 h-36 bg-[#F8F4E9] rounded-xl border border-black shadow-[0_0_20px_rgba(0,0,0,0.8)] flex flex-col transform rotate-3 origin-bottom hover:-translate-y-4 hover:z-50 transition-transform cursor-pointer z-30">
              <div className="p-2 flex flex-col text-[#C8102E]">
                <span className="font-bold text-xl leading-none">9</span>
                <span className="text-xl leading-none">♥</span>
              </div>
            </div>

            {/* 2♣ */}
            <div className="w-24 h-36 bg-[#F8F4E9] rounded-xl border border-black shadow-[0_0_20px_rgba(0,0,0,0.8)] flex flex-col transform rotate-6 origin-bottom-left hover:-translate-y-4 hover:z-50 transition-transform cursor-pointer z-40">
              <div className="p-2 flex flex-col text-[#1B5E20]">
                <span className="font-bold text-xl leading-none">2</span>
                <span className="text-xl leading-none">♣</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
