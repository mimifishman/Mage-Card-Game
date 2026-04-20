export function MatchHeader() {
  const bg = "#0A0A0A";
  const bgSurface = "#1C1C1C";
  const bgCard = "#141414";
  const border = "#2A2A2A";
  const text = "#FFFFFF";
  const textMuted = "#888888";
  const gradStart = "#C8A0C8";
  const gradEnd = "#9080C8";
  const gold = "#C8A050";
  const red = "#C8102E";

  type Phase = { label: string; color: string; glow: string };
  const phases: Record<string, Phase> = {
    DRAW:   { label: "DRAW",   color: "#5090D0", glow: "rgba(80,144,208,0.3)" },
    MAIN:   { label: "MAIN",   color: "#50C880", glow: "rgba(80,200,128,0.3)" },
    ATTACK: { label: "ATTACK ⚔", color: "#C85050", glow: "rgba(200,80,80,0.3)" },
    BLOCK:  { label: "BLOCKS 🛡", color: "#C06030", glow: "rgba(192,96,48,0.3)" },
    END:    { label: "END",    color: gold,       glow: "rgba(200,160,80,0.3)" },
  };

  const Stat = ({ icon, label, value, color, bg: statBg, borderColor }: { icon: string; label: string; value: string | number; color: string; bg: string; borderColor: string }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: statBg,
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        padding: "8px 14px",
        minWidth: 64,
        gap: 1,
      }}
    >
      <span style={{ fontSize: 13, color, opacity: 0.8 }}>{icon}</span>
      <span style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 28,
        fontWeight: 400,
        color,
        lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{ fontSize: 9, color, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
    </div>
  );

  const HeaderVariant = ({
    phase,
    isMyTurn,
    turnNum,
    life,
    vault,
  }: {
    phase: keyof typeof phases;
    isMyTurn: boolean;
    turnNum: number;
    life: number;
    vault: number;
  }) => {
    const p = phases[phase];
    return (
      <div
        style={{
          background: "rgba(10,10,10,0.97)",
          borderBottom: `1px solid ${border}`,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Left: phase + end game */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, alignItems: "flex-start" }}>
          <div
            style={{
              borderRadius: 20,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 5,
              paddingBottom: 5,
              border: `1px solid ${p.color}`,
              background: `rgba(${parseInt(p.color.slice(1,3),16)},${parseInt(p.color.slice(3,5),16)},${parseInt(p.color.slice(5,7),16)},0.12)`,
              boxShadow: `0 0 10px ${p.glow}`,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: p.color, letterSpacing: 1.5 }}>
              {p.label}
            </span>
          </div>
          <div
            style={{
              borderRadius: 6,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 3,
              paddingBottom: 3,
              border: "1px solid rgba(200,16,46,0.3)",
              background: "rgba(200,16,46,0.06)",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: "#C84040", letterSpacing: 0.5 }}>⚑ End Game</span>
          </div>
        </div>

        {/* Center: turn */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          {isMyTurn ? (
            <div
              style={{
                background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`,
                borderRadius: 20,
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 7,
                paddingBottom: 7,
                boxShadow: `0 0 14px rgba(180,130,200,0.5)`,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, color: "#FFF", letterSpacing: 2 }}>YOUR TURN</span>
            </div>
          ) : (
            <span
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 14,
                color: text,
              }}
            >
              DarkMage's Turn
            </span>
          )}
          <span style={{ fontSize: 10, color: textMuted }}>Turn {turnNum}</span>
        </div>

        {/* Right: life + vault */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
          <Stat icon="♥" label="Life" value={life} color={red} bg="rgba(200,16,46,0.1)" borderColor="rgba(200,16,46,0.35)" />
          <Stat icon="⚡" label="Vault" value={vault} color={gold} bg="rgba(200,160,80,0.1)" borderColor="rgba(200,160,80,0.35)" />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: 390,
        minHeight: 844,
        background: bg,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Three header variants stacked with labels */}
      <div style={{ paddingTop: 56, display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Label */}
        <div style={{ padding: "12px 16px 8px", fontSize: 10, color: textMuted, letterSpacing: 2, textTransform: "uppercase" }}>
          YOUR TURN — Main Phase
        </div>
        <HeaderVariant phase="MAIN" isMyTurn={true} turnNum={4} life={3} vault={7} />

        <div style={{ padding: "16px 16px 8px", fontSize: 10, color: textMuted, letterSpacing: 2, textTransform: "uppercase" }}>
          Opponent's Turn — Attack Phase
        </div>
        <HeaderVariant phase="ATTACK" isMyTurn={false} turnNum={5} life={2} vault={4} />

        <div style={{ padding: "16px 16px 8px", fontSize: 10, color: textMuted, letterSpacing: 2, textTransform: "uppercase" }}>
          YOUR TURN — Draw Phase
        </div>
        <HeaderVariant phase="DRAW" isMyTurn={true} turnNum={6} life={1} vault={9} />
      </div>

      {/* Action button examples */}
      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          Action Buttons — Thumb Zone
        </div>

        {/* Phase color pills showcase */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {Object.values(phases).map((p, i) => (
            <div
              key={i}
              style={{
                borderRadius: 20,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 5,
                paddingBottom: 5,
                border: `1px solid ${p.color}`,
                background: `rgba(${parseInt(p.color.slice(1,3),16)},${parseInt(p.color.slice(3,5),16)},${parseInt(p.color.slice(5,7),16)},0.12)`,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: p.color, letterSpacing: 1 }}>{p.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              flex: 1,
              background: "rgba(200,16,46,0.12)",
              border: "1px solid rgba(200,16,46,0.4)",
              borderRadius: 16,
              padding: "16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              minHeight: 56,
            }}
          >
            <span style={{ fontSize: 16 }}>⚔️</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#C85050" }}>Attack!</span>
          </div>
          <div
            style={{
              flex: 1.2,
              background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`,
              borderRadius: 16,
              padding: "16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              minHeight: 56,
              boxShadow: `0 4px 16px rgba(180,130,200,0.3)`,
            }}
          >
            <span
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 15,
                color: "#FFF",
              }}
            >
              End Turn →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
