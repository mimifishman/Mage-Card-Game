import React from "react";
import { Heart, Zap, Shield, Swords, Flame, Droplets } from "lucide-react";

export function BrightTable() {
  return (
    <div
      className="bg-[#F8F8F8] text-[#1C1C1E] font-sans antialiased relative select-none flex flex-col"
      style={{ width: 390, height: 844, overflow: "hidden" }}
    >
      {/* Header / Stats */}
      <div className="flex items-center justify-between px-6 pt-12 pb-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-1">Dorian</span>
            <div className="flex items-center gap-4 text-lg font-bold text-gray-700">
              <span className="flex items-center gap-1"><span className="text-red-600">♥</span> 20</span>
              <span className="flex items-center gap-1"><span>⚡</span> 3</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-right">
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-1">Lyra (You)</span>
            <div className="flex items-center gap-4 text-lg font-bold text-gray-700">
              <span className="flex items-center gap-1"><span className="text-red-600">♥</span> 18</span>
              <span className="flex items-center gap-1"><span>⚡</span> 5</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-8 space-y-4 overflow-y-auto hide-scrollbar">
        
        {/* Opponent Zone */}
        <Zone title="Opponent">
          <div className="flex justify-center gap-3 py-2">
            <CardBack />
            <CardBack />
            <CardBack />
          </div>
        </Zone>

        {/* Shared (Mine · Abyss) */}
        <Zone title="Shared (Mine · Abyss)">
          <div className="flex justify-center gap-3 py-2">
            <Card rank="10" suit="♦" color="red" />
            <div className="w-16 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <span className="text-gray-400 text-xs uppercase tracking-wider">Empty</span>
            </div>
            <Card rank="A" suit="♠" color="black" />
          </div>
        </Zone>

        {/* Your Court */}
        <Zone title="Your Court">
          <div className="flex justify-center gap-3 py-2">
            <Card rank="Q" suit="♥" color="red" />
            <Card rank="8" suit="♣" color="black" />
            <Card rank="3" suit="♦" color="red" />
          </div>
        </Zone>

        {/* Your Hand */}
        <Zone title="Your Hand" className="mt-auto border-none pt-4">
          <div className="flex justify-center gap-2">
            <Card rank="J" suit="♠" color="black" />
            <Card rank="7" suit="♥" color="red" />
            <Card rank="Q" suit="♦" color="red" />
            <Card rank="8" suit="♣" color="black" />
            <Card rank="3" suit="♦" color="red" />
          </div>
        </Zone>

        {/* Actions */}
        <div className="flex gap-3 justify-center pt-2">
          <button className="flex-1 bg-white border border-[#E5E5E5] text-[#1C1C1E] py-3 rounded text-sm font-semibold tracking-wide uppercase shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors">
            Pass
          </button>
          <button className="flex-1 bg-white border border-[#E5E5E5] text-[#1C1C1E] py-3 rounded text-sm font-semibold tracking-wide uppercase shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors">
            End Turn
          </button>
        </div>

      </div>
    </div>
  );
}

function Zone({ title, children, className = "" }: { title: string, children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="h-px bg-[#E5E5E5] flex-1" />
        <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-medium">{title}</span>
        <div className="h-px bg-[#E5E5E5] flex-1" />
      </div>
      {children}
    </div>
  );
}

function Card({ rank, suit, color }: { rank: string, suit: string, color: "red" | "black" }) {
  const textColor = color === "red" ? "text-[#DC2626]" : "text-[#1C1C1E]";
  return (
    <div className="w-[68px] h-[96px] bg-white border border-[#E5E5E5] rounded-lg shadow-sm flex flex-col justify-between p-1.5 shrink-0 relative overflow-hidden">
      {/* Top Left */}
      <div className={`flex flex-col items-center leading-none ${textColor} w-4`}>
        <span className="text-sm font-bold">{rank}</span>
        <span className="text-[10px]">{suit}</span>
      </div>
      
      {/* Center Large Suit */}
      <div className={`absolute inset-0 flex items-center justify-center opacity-20 ${textColor}`}>
        <span className="text-5xl">{suit}</span>
      </div>

      {/* Bottom Right */}
      <div className={`flex flex-col items-center leading-none ${textColor} w-4 self-end rotate-180`}>
        <span className="text-sm font-bold">{rank}</span>
        <span className="text-[10px]">{suit}</span>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="w-[68px] h-[96px] bg-white border border-[#E5E5E5] rounded-lg shadow-sm p-1 shrink-0">
      <div 
        className="w-full h-full rounded opacity-80" 
        style={{
          backgroundSize: "8px 8px",
          backgroundImage: "repeating-linear-gradient(45deg, #DC2626 0, #DC2626 1px, transparent 1px, transparent 4px, #1C1C1E 4px, #1C1C1E 5px, transparent 5px, transparent 8px)"
        }}
      />
    </div>
  );
}
