export function Lobby() {
  const bg = "#0D2B1A";
  const bgCard = "#122019";
  const bgSurface = "#1A3A28";
  const gold = "#C89B3C";
  const goldDim = "#9A7530";
  const red = "#C8102E";
  const text = "#E8EFE8";
  const textMuted = "#7A9E88";
  const border = "#2A4A36";

  return (
    <div
      style={{
        width: 390,
        minHeight: 844,
        background: bg,
        fontFamily: "'Inter', system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Felt texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, rgba(21, 58, 36, 0.9) 0%, rgba(10, 28, 18, 0.6) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Suit watermarks */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: -20,
          fontSize: 180,
          color: "rgba(200,155,60,0.05)",
          lineHeight: 1,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        ♠
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: -30,
          fontSize: 200,
          color: "rgba(200,16,46,0.05)",
          lineHeight: 1,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        ♥
      </div>

      {/* Header */}
      <div style={{ paddingTop: 64, paddingBottom: 16, textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Crown + suit row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          {["♠", "♣"].map((s) => (
            <span key={s} style={{ fontSize: 20, color: textMuted, opacity: 0.6 }}>{s}</span>
          ))}
          <span style={{ fontSize: 26, color: gold }}>👑</span>
          {["♦", "♥"].map((s) => (
            <span key={s} style={{ fontSize: 20, color: red, opacity: 0.6 }}>{s}</span>
          ))}
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: gold, margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>
          Mage
        </h1>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: text, margin: 0, opacity: 0.7, letterSpacing: 6, textTransform: "uppercase" }}>
          Card Game
        </h2>

        {/* Horizontal rule with suits */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 32px 0" }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${border})` }} />
          <span style={{ color: goldDim, fontSize: 14 }}>✦</span>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${border})` }} />
        </div>
      </div>

      {/* User badge */}
      <div style={{ padding: "0 24px", marginBottom: 32, position: "relative", zIndex: 1 }}>
        <div
          style={{
            background: bgSurface,
            borderRadius: 12,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: `1px solid ${border}`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: `rgba(200,155,60,0.15)`,
              border: `1px solid ${gold}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🧙
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: text }}>WizardPlayer42</div>
            <div style={{ fontSize: 11, color: textMuted }}>Mage • Level 12</div>
          </div>
          <div style={{ marginLeft: "auto", color: textMuted, fontSize: 12, cursor: "pointer" }}>Sign out</div>
        </div>
      </div>

      {/* Main actions */}
      <div style={{ flex: 1, padding: "0 24px", display: "flex", flexDirection: "column", gap: 14, position: "relative", zIndex: 1 }}>
        {/* New Game button */}
        <button
          style={{
            background: `linear-gradient(135deg, ${gold}, ${goldDim})`,
            border: "none",
            borderRadius: 16,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            cursor: "pointer",
            boxShadow: `0 4px 24px rgba(200,155,60,0.35)`,
          }}
        >
          <span style={{ fontSize: 22 }}>⚔️</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0D2B1A", letterSpacing: 0.5 }}>New Game</div>
            <div style={{ fontSize: 12, color: "rgba(13,43,26,0.65)", fontWeight: 500 }}>Create a match for 2–4 players</div>
          </div>
        </button>

        {/* Join Game */}
        <button
          style={{
            background: bgSurface,
            border: `1px solid ${border}`,
            borderRadius: 16,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 22 }}>🎴</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: text, letterSpacing: 0.5 }}>Join Game</div>
            <div style={{ fontSize: 12, color: textMuted, fontWeight: 400 }}>Enter an invite code</div>
          </div>
          <span style={{ marginLeft: "auto", color: textMuted, fontSize: 18 }}>›</span>
        </button>

        {/* Join input (expanded) */}
        <div
          style={{
            background: bgCard,
            border: `1px solid ${gold}`,
            borderRadius: 16,
            padding: 16,
            display: "flex",
            gap: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              background: bgSurface,
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 22,
              fontWeight: 800,
              color: gold,
              letterSpacing: 8,
              textAlign: "center",
              border: `1px solid ${border}`,
            }}
          >
            A B C D
          </div>
          <button
            style={{
              background: `linear-gradient(135deg, ${gold}, ${goldDim})`,
              border: "none",
              borderRadius: 10,
              padding: "0 18px",
              fontSize: 14,
              fontWeight: 700,
              color: "#0D2B1A",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Join →
          </button>
        </div>

        {/* Deck stats row */}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {[
            { icon: "♠", label: "Spades", val: "13", color: text },
            { icon: "♥", label: "Hearts", val: "13", color: red },
            { icon: "♦", label: "Diamonds", val: "13", color: "#1565C0" },
            { icon: "♣", label: "Clubs", val: "13", color: text },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                background: bgSurface,
                borderRadius: 10,
                padding: "10px 0",
                textAlign: "center",
                border: `1px solid ${border}`,
              }}
            >
              <div style={{ fontSize: 20, color: s.color }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 9, color: textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
