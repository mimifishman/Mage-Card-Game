import React from 'react';
import { Heart, Zap, Shield, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FocusMode() {
  return (
    <div style={{ width: 390, height: 844, overflow: 'hidden' }} className="relative bg-zinc-950 font-sans text-slate-50 select-none flex flex-col">
      {/* Top Bar - Player Stats & Phase */}
      <div className="absolute top-0 left-0 w-full h-12 bg-zinc-900/90 border-b border-zinc-800/50 flex items-center justify-between px-5 z-20 backdrop-blur-md">
        <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">Action Phase</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-zinc-950/50 px-2 py-1 rounded-md border border-zinc-800/50">
            <Heart size={14} className="text-rose-500" fill="currentColor" />
            <span className="text-sm font-bold text-rose-50">18</span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-950/50 px-2 py-1 rounded-md border border-zinc-800/50">
            <Zap size={14} className="text-amber-400" fill="currentColor" />
            <span className="text-sm font-bold text-amber-50">5</span>
          </div>
        </div>
      </div>

      {/* Opponent Status Chip */}
      <div className="absolute top-16 left-5 flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/50 rounded-full pr-4 p-1.5 z-20 backdrop-blur-md shadow-sm">
        <div className="w-7 h-7 rounded-full bg-indigo-900/80 flex items-center justify-center text-xs font-bold text-indigo-200 border border-indigo-700/50">
          D
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-rose-400/80 text-xs font-semibold"><Heart size={12} fill="currentColor" /> 20</span>
          <span className="flex items-center gap-1 text-amber-400/80 text-xs font-semibold"><Zap size={12} fill="currentColor" /> 3</span>
        </div>
      </div>

      {/* Mine / Abyss */}
      <div className="absolute top-16 right-5 bg-zinc-900/60 border border-zinc-800/50 rounded-full px-4 py-2 text-[10px] text-zinc-400 z-20 backdrop-blur-md font-mono tracking-wider shadow-sm">
        MINE <span className="text-zinc-200">28</span> <span className="text-zinc-700 mx-1">·</span> ABYSS <span className="text-zinc-200">6</span>
      </div>

      {/* Slim Court */}
      <div className="absolute top-36 left-5 z-10 flex flex-col gap-2">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Your Court</span>
        <div className="flex gap-2">
          {/* Tiny Card 1 */}
          <div className="w-[45px] h-[65px] bg-zinc-100 rounded-md border-2 border-zinc-300 flex flex-col items-center justify-center shadow-md transform -rotate-2">
            <span className="text-[11px] font-black text-rose-600">A♥</span>
          </div>
          {/* Tiny Card 2 */}
          <div className="w-[45px] h-[65px] bg-zinc-100 rounded-md border-2 border-zinc-300 flex flex-col items-center justify-center shadow-md transform rotate-1">
            <span className="text-[11px] font-black text-zinc-900">K♠</span>
          </div>
        </div>
      </div>

      {/* Hand Area (Focus) */}
      <div className="absolute bottom-0 left-0 w-full h-[65%] flex items-end justify-center pb-12 z-0 overflow-visible" style={{ perspective: '1200px' }}>
        {/* Soft radial glow behind hand */}
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative w-full h-full flex flex-col justify-end items-center mb-8">
          
          {/* Active Card Label */}
          <div className="mb-10 bg-zinc-800/80 text-zinc-200 text-xs px-4 py-1.5 rounded-full backdrop-blur-md border border-zinc-700/50 font-medium tracking-wide shadow-lg transform -translate-y-4 opacity-0 transition-opacity">
            Select target
          </div>

          {/* Fanned Cards */}
          <div className="relative w-[340px] h-[220px] flex justify-center items-end">
             {/* Card 1 */}
             <div className="absolute bottom-0 left-0 w-[115px] h-[170px] bg-zinc-50 rounded-xl shadow-2xl border border-zinc-300 flex flex-col p-3 transform -rotate-[16deg] -translate-x-12 translate-y-6 origin-bottom-right transition-all duration-300 hover:-translate-y-8 hover:-rotate-8 hover:z-30 cursor-pointer group">
               <div className="text-zinc-900 font-black text-2xl leading-none">J</div>
               <div className="text-zinc-900 text-2xl leading-none mt-1">♠</div>
               <div className="mt-auto flex justify-center">
                 <div className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center bg-zinc-100 opacity-60 group-hover:opacity-100 transition-opacity shadow-inner">
                   <Swords size={20} className="text-zinc-700" />
                 </div>
               </div>
             </div>

             {/* Card 2 */}
             <div className="absolute bottom-0 left-[40px] w-[120px] h-[175px] bg-zinc-50 rounded-xl shadow-2xl border border-zinc-300 flex flex-col p-3 transform -rotate-[8deg] -translate-x-4 translate-y-2 origin-bottom transition-all duration-300 hover:-translate-y-10 hover:-rotate-4 hover:z-30 cursor-pointer group z-10">
               <div className="text-rose-600 font-black text-2xl leading-none">7</div>
               <div className="text-rose-600 text-2xl leading-none mt-1">♥</div>
               <div className="mt-auto flex justify-center">
                  <div className="w-12 h-12 rounded-full border border-rose-100 flex items-center justify-center bg-rose-50 opacity-60 group-hover:opacity-100 transition-opacity shadow-inner">
                    <Heart size={20} className="text-rose-500" />
                  </div>
               </div>
             </div>

             {/* Card 3 (Center focus - intentionally popped out slightly to show focus mode interaction) */}
             <div className="absolute bottom-0 left-[110px] w-[130px] h-[190px] bg-zinc-50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-2 border-amber-400 flex flex-col p-3 transform -translate-y-8 z-20 origin-bottom transition-all duration-300 hover:-translate-y-12 cursor-pointer group">
               <div className="text-rose-600 font-black text-3xl leading-none">Q</div>
               <div className="text-rose-600 text-3xl leading-none mt-1">♦</div>
               
               <div className="absolute top-3 right-3 flex flex-col items-center bg-amber-100/50 p-1.5 rounded-lg border border-amber-200">
                  <Zap size={12} className="text-amber-600 mb-0.5" fill="currentColor" />
                  <span className="text-[11px] font-black text-amber-700 leading-none">3</span>
               </div>
               
               <div className="mt-auto w-full pt-4">
                 <div className="h-20 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-medium text-zinc-600 p-2 text-center leading-relaxed shadow-inner">
                   Deal 3 damage to any target. Draw a card.
                 </div>
               </div>
             </div>

             {/* Card 4 */}
             <div className="absolute bottom-0 right-[40px] w-[120px] h-[175px] bg-zinc-50 rounded-xl shadow-2xl border border-zinc-300 flex flex-col p-3 transform rotate-[8deg] translate-x-4 translate-y-2 origin-bottom transition-all duration-300 hover:-translate-y-10 hover:rotate-4 hover:z-30 cursor-pointer group z-10">
               <div className="text-zinc-900 font-black text-2xl leading-none">8</div>
               <div className="text-zinc-900 text-2xl leading-none mt-1">♣</div>
               <div className="mt-auto flex justify-center">
                  <div className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center bg-zinc-100 opacity-60 group-hover:opacity-100 transition-opacity shadow-inner">
                    <Shield size={20} className="text-zinc-700" />
                  </div>
               </div>
             </div>

             {/* Card 5 */}
             <div className="absolute bottom-0 right-0 w-[115px] h-[170px] bg-zinc-50 rounded-xl shadow-2xl border border-zinc-300 flex flex-col p-3 transform rotate-[16deg] translate-x-12 translate-y-6 origin-bottom-left transition-all duration-300 hover:-translate-y-8 hover:rotate-8 hover:z-30 cursor-pointer group">
               <div className="text-rose-600 font-black text-2xl leading-none">3</div>
               <div className="text-rose-600 text-2xl leading-none mt-1">♦</div>
             </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <Button 
        size="lg"
        className="absolute bottom-8 right-5 h-14 rounded-full shadow-[0_10px_40px_rgba(79,70,229,0.5)] bg-indigo-600 hover:bg-indigo-500 text-white px-7 font-bold tracking-wide z-30 flex items-center gap-2 border border-indigo-500 transition-transform hover:scale-105"
      >
        Attack
        <Swords size={18} />
      </Button>

    </div>
  );
}

export default FocusMode;
