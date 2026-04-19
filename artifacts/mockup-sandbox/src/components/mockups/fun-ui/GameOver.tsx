export function GameOver() {
  const bg = "#0D2B1A";
  const bgCard = "#122019";
  const bgSurface = "#1A3A28";
  const gold = "#C89B3C";
  const goldDim = "#9A7530";
  const red = "#C8102E";
  const green = "#2E8B57";
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
      {/* === VICTORY half (top) === */}
      <div
        style={{
          flex: 1,
          background: "linear-gradient(180deg, #0D2B1A 0%, #0F3820 50%, #0D2B1A 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px 24px",
          position: "relative",
          borderBottom: `2px solid ${border}`,
        }}
      >
        {/* Stars / confetti */}
        {["★", "✦", "★", "✦", "★"].map((s, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: 20 + Math.sin(i * 1.5) * 30,
              left: 40 + i * 70,
              color: gold,
              opacity: 0.4 + i * 0.1,
              fontSize: 14 + i * 3,
              userSelect: "none",
            }}
          >
            {s}
          </span>
        ))}

        {/* Victory crown */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            background: "rgba(200,155,60,0.12)",
            border: `2px solid ${gold}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 60,
            marginBottom: 16,
            boxShadow: `0 0 40px rgba(200,155,60,0.3), 0 0 80px rgba(200,155,60,0.1)`,
          }}
        >
          🏆
        </div>

        <div
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: gold,
            textTransform: "uppercase",
            letterSpacing: 3,
            textShadow: `0 0 30px rgba(200,155,60,0.5)`,
            marginBottom: 8,
          }}
        >
          Victory!
        </div>

        <div style={{ fontSize: 16, color: text, opacity: 0.7, marginBottom: 16 }}>
          You conquered all challengers
        </div>

        {/* Suit celebration row */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[{ s: "♠", c: text }, { s: "♥", c: red }, { s: "♦", c: "#1565C0" }, { s: "♣", c: text }].map((x) => (
            <span key={x.s} style={{ fontSize: 24, color: x.c, opacity: 0.8 }}>{x.s}</span>
          ))}
        </div>

        {/* Score summary */}
        <div
          style={{
            background: bgSurface,
            borderRadius: 14,
            padding: "14px 20px",
            display: "flex",
            gap: 20,
            border: `1px solid ${border}`,
          }}
        >
          {[
            { icon: "♥", label: "Life Left", val: "3", color: red },
            { icon: "⚡", label: "Vault", val: "5", color: gold },
            { icon: "⚔️", label: "Kills", val: "2", color: text },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* === DEFEAT half (bottom) === */}
      <div
        style={{
          flex: 1,
          background: "linear-gradient(180deg, #1A0810 0%, #200B0F 50%, #1A0810 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 24px 20px",
          position: "relative",
        }}
      >
        {/* Skull */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            background: "rgba(192,57,43,0.12)",
            border: `2px solid ${red}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            marginBottom: 10,
          }}
        >
          💀
        </div>

        <div style={{ fontSize: 32, fontWeight: 800, color: red, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
          Defeated
        </div>

        <div style={{ fontSize: 13, color: textMuted, marginBottom: 12 }}>
          WizardKing42 wins the match!
        </div>

        <div
          style={{
            background: "rgba(200,155,60,0.1)",
            border: `1px solid rgba(200,155,60,0.3)`,
            borderRadius: 20,
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 14 }}>🏆</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: gold }}>WizardKing42</span>
        </div>

        {/* Buttons */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            style={{
              width: "100%",
              background: `linear-gradient(135deg, ${green}, #1E6B3A)`,
              border: "none",
              borderRadius: 16,
              padding: "16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              cursor: "pointer",
              boxShadow: `0 4px 16px rgba(46,139,87,0.3)`,
            }}
          >
            <span style={{ fontSize: 18 }}>🔄</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#FFF" }}>Rematch</span>
          </button>
          <button
            style={{
              width: "100%",
              background: "transparent",
              border: `1px solid ${border}`,
              borderRadius: 16,
              padding: "14px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              color: textMuted,
            }}
          >
            <span style={{ fontSize: 16 }}>🏠</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Back to Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
}
