import React from 'react';
import { Heart, Zap, Sparkles, Star } from 'lucide-react';

export function StorybookRealm() {
  return (
    <div 
      className="relative overflow-hidden font-['Quicksand'] selection:bg-[#F4B8C1]"
      style={{ 
        width: 390, 
        height: 844, 
        backgroundColor: '#FFF8F0',
        color: '#2B3A52',
        boxShadow: '0 0 20px rgba(0,0,0,0.1)'
      }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&display=swap');
        .storybook-shadow {
          box-shadow: 0 4px 14px rgba(43, 58, 82, 0.08), 0 2px 4px rgba(43, 58, 82, 0.04);
        }
        .storybook-card {
          box-shadow: 0 6px 16px rgba(43, 58, 82, 0.08), inset 0 2px 4px rgba(255, 255, 255, 0.5);
        }
      `}} />

      {/* Decorative Background Elements */}
      <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-[#F4B8C1] rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-[200px] right-[-50px] w-80 h-80 bg-[#B8D4E8] rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute top-[300px] left-[100px] w-48 h-48 bg-[#F5DFA0] rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none" />

      {/* Header Strip */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/60 backdrop-blur-md border-b-2 border-white/80 rounded-b-3xl relative z-10 storybook-shadow">
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-widest text-[#B8D4E8] uppercase drop-shadow-sm">Turn 4</span>
          <span className="text-lg font-bold text-[#2B3A52] flex items-center gap-1">
            <Sparkles size={16} className="text-[#F5DFA0]" /> Main Phase
          </span>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 bg-[#F4B8C1]/20 px-3 py-1.5 rounded-full border border-[#F4B8C1]/30">
            <Heart size={16} className="text-[#F4B8C1] fill-[#F4B8C1]" />
            <span className="font-bold text-lg">20</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#B8D4E8]/20 px-3 py-1.5 rounded-full border border-[#B8D4E8]/30">
            <Zap size={16} className="text-[#B8D4E8] fill-[#B8D4E8]" />
            <span className="font-bold text-lg">4</span>
          </div>
        </div>
      </div>

      {/* Opponent Section */}
      <div className="px-4 py-4 space-y-3 relative z-10">
        {/* Opponent 1 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-3 storybook-shadow border-2 border-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#C8DEC0] flex items-center justify-center border-2 border-white storybook-shadow shadow-inner">
              <span className="font-bold text-xl text-white drop-shadow-md">D</span>
            </div>
            <div>
              <div className="font-bold text-[#2B3A52]">Dorian</div>
              <div className="flex gap-2 text-sm font-semibold">
                <span className="flex items-center gap-1 text-[#F4B8C1]"><Heart size={12} className="fill-[#F4B8C1]"/> 18</span>
                <span className="flex items-center gap-1 text-[#B8D4E8]"><Zap size={12} className="fill-[#B8D4E8]"/> 2</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Opponent Court Cards (Thumbnails) */}
            <div className="w-9 h-12 bg-[#F4B8C1]/20 rounded-lg border-2 border-[#F4B8C1]/40 flex flex-col items-center justify-center storybook-card">
              <span className="text-[10px] font-bold text-[#F4B8C1]">K♥</span>
            </div>
            <div className="w-9 h-12 bg-[#B8D4E8]/20 rounded-lg border-2 border-[#B8D4E8]/40 flex flex-col items-center justify-center storybook-card">
              <span className="text-[10px] font-bold text-[#B8D4E8]">Q♠</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mine / Abyss Row */}
      <div className="flex justify-center gap-6 py-2 relative z-10">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-24 bg-gradient-to-br from-[#B8D4E8] to-[#9ABCD4] rounded-xl storybook-card border-2 border-white flex items-center justify-center relative overflow-hidden group">
             <Star className="text-white/40 absolute" size={32} />
          </div>
          <div className="bg-white/80 px-3 py-1 rounded-full storybook-shadow text-xs font-bold text-[#2B3A52]">
            Mine · 28
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-24 bg-gradient-to-br from-[#2B3A52] to-[#1E293B] rounded-xl storybook-card border-2 border-[#2B3A52]/50 flex items-center justify-center opacity-80">
            <span className="text-white/20 font-bold text-2xl">?</span>
          </div>
          <div className="bg-white/80 px-3 py-1 rounded-full storybook-shadow text-xs font-bold text-[#2B3A52]">
            Abyss · 6
          </div>
        </div>
      </div>

      {/* Cloud Divider */}
      <div className="flex justify-center py-2 relative z-10">
        <div className="h-1 w-32 bg-gradient-to-r from-transparent via-[#C8DEC0] to-transparent rounded-full opacity-50" />
      </div>

      {/* My Court */}
      <div className="px-6 py-2 relative z-10">
        <div className="text-center mb-3 text-sm font-bold text-[#C8DEC0] uppercase tracking-widest drop-shadow-sm">My Court</div>
        <div className="flex justify-center gap-4">
          {/* Card 1: Diamond */}
          <div className="w-24 h-36 bg-[#F5DFA0]/20 rounded-2xl storybook-card border-2 border-white relative overflow-hidden flex flex-col items-center justify-center transform -rotate-2 hover:rotate-0 transition-transform">
             <div className="absolute top-2 left-2 flex flex-col items-center">
                <span className="font-bold text-[#D4A373] text-lg">J</span>
                <span className="text-[#D4A373] text-sm">♦</span>
             </div>
             <div className="text-4xl text-[#D4A373] drop-shadow-md">♦</div>
             <div className="absolute bottom-2 w-full text-center text-[10px] font-bold text-[#D4A373] uppercase tracking-wider">Jack</div>
          </div>
          
          {/* Card 2: Heart */}
          <div className="w-24 h-36 bg-[#F4B8C1]/20 rounded-2xl storybook-card border-2 border-white relative overflow-hidden flex flex-col items-center justify-center transform rotate-2 hover:rotate-0 transition-transform mt-2">
             <div className="absolute top-2 left-2 flex flex-col items-center">
                <span className="font-bold text-[#E5989B] text-lg">7</span>
                <span className="text-[#E5989B] text-sm">♥</span>
             </div>
             <div className="text-4xl text-[#E5989B] drop-shadow-md">♥</div>
             <div className="absolute bottom-2 w-full text-center text-[10px] font-bold text-[#E5989B] uppercase tracking-wider">Seven</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-[200px] w-full px-6 flex justify-center gap-4 z-20">
        <button className="bg-gradient-to-r from-[#F4B8C1] to-[#E5989B] text-white font-bold py-3 px-8 rounded-full storybook-shadow border-2 border-white transform hover:scale-105 transition-transform active:scale-95 text-lg flex items-center gap-2">
          <Star size={20} className="fill-white" /> Attack!
        </button>
        <button className="bg-white text-[#2B3A52] font-bold py-3 px-6 rounded-full storybook-shadow border-2 border-white/80 transform hover:scale-105 transition-transform active:scale-95 text-lg">
          End Turn
        </button>
      </div>

      {/* Hand Tray */}
      <div className="absolute bottom-0 w-full h-[180px] bg-white/40 backdrop-blur-xl border-t-2 border-white/60 rounded-t-[40px] storybook-shadow z-30">
        <div className="absolute top-[-15px] left-1/2 transform -translate-x-1/2 bg-[#FFF8F0] px-4 py-1 rounded-full text-xs font-bold text-[#C8DEC0] border-2 border-white storybook-shadow">
          Your Hand
        </div>
        
        <div className="flex justify-center items-end h-full pb-6 px-4 gap-[-20px]">
          {/* Card 1: Spades */}
          <div className="w-20 h-28 bg-[#B8D4E8]/20 rounded-xl storybook-card border-2 border-white relative overflow-hidden flex flex-col transform -rotate-6 translate-x-4 translate-y-2 hover:-translate-y-4 transition-transform z-10 bg-white">
            <div className="p-2 flex flex-col items-center">
              <span className="font-bold text-[#6B90B2] text-sm">Q</span>
              <span className="text-[#6B90B2] text-xs">♠</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
               <div className="text-3xl text-[#6B90B2] opacity-40">♠</div>
            </div>
          </div>
          
          {/* Card 2: Diamonds */}
          <div className="w-20 h-28 bg-[#F5DFA0]/20 rounded-xl storybook-card border-2 border-white relative overflow-hidden flex flex-col transform -rotate-2 translate-x-2 hover:-translate-y-4 transition-transform z-20 bg-white shadow-xl">
            <div className="p-2 flex flex-col items-center">
              <span className="font-bold text-[#D4A373] text-sm">3</span>
              <span className="text-[#D4A373] text-xs">♦</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
               <div className="text-3xl text-[#D4A373] opacity-40">♦</div>
            </div>
          </div>

          {/* Card 3: Clubs */}
          <div className="w-20 h-32 bg-[#C8DEC0]/20 rounded-xl storybook-card border-2 border-white relative overflow-hidden flex flex-col transform -translate-y-2 hover:-translate-y-6 transition-transform z-30 bg-white shadow-xl">
            <div className="p-2 flex flex-col items-center">
              <span className="font-bold text-[#8FA885] text-sm">8</span>
              <span className="text-[#8FA885] text-xs">♣</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
               <div className="text-4xl text-[#8FA885] opacity-40">♣</div>
            </div>
          </div>

          {/* Card 4: Hearts */}
          <div className="w-20 h-28 bg-[#F4B8C1]/20 rounded-xl storybook-card border-2 border-white relative overflow-hidden flex flex-col transform rotate-3 -translate-x-2 hover:-translate-y-4 transition-transform z-40 bg-white shadow-xl">
            <div className="p-2 flex flex-col items-center">
              <span className="font-bold text-[#E5989B] text-sm">A</span>
              <span className="text-[#E5989B] text-xs">♥</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
               <div className="text-3xl text-[#E5989B] opacity-40">♥</div>
            </div>
          </div>

          {/* Card 5: Spades */}
          <div className="w-20 h-28 bg-[#B8D4E8]/20 rounded-xl storybook-card border-2 border-white relative overflow-hidden flex flex-col transform rotate-8 -translate-x-4 translate-y-3 hover:-translate-y-4 transition-transform z-50 bg-white shadow-xl">
            <div className="p-2 flex flex-col items-center">
              <span className="font-bold text-[#6B90B2] text-sm">9</span>
              <span className="text-[#6B90B2] text-xs">♠</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
               <div className="text-3xl text-[#6B90B2] opacity-40">♠</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
