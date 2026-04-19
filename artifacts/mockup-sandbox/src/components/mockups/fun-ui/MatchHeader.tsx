export function MatchHeader() {
  const bg = "#0D2B1A";
  const bgCard = "#122019";
  const bgSurface = "#1A3A28";
  const gold = "#C89B3C";
  const goldDim = "#9A7530";
  const red = "#C8102E";
  const blue = "#1565C0";
  const green = "#2E8B57";
  const text = "#E8EFE8";
  const textMuted = "#7A9E88";
  const border = "#2A4A36";

  const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
    draw: { bg: "rgba(21,101,192,0.2)", border: "#1565C0", text: "#64B5F6", label: "DRAW" },
    main: { bg: "rgba(46,139,87,0.2)", border: green, text: "#6FCF97", label: "MAIN" },
    attack: { bg: "rgba(200,16,46,0.2)", border: red, text: "#F28B82", label: "ATTACK ⚔" },
    block: { bg: "rgba(200,16,46,0.15)", border: "#A0102E", text: "#F48FB1", label: "BLOCKS 🛡" },
    end: { bg: "rgba(150,100,50,0.15)", border: goldDim, text: gold, label: "END" },
  };

  return (
    <div
      style={{
        width: 390,
        minHeight: 844,
        background: bg,
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(26,58,40,0.7) 0%, rgba(8,20,13,0.4) 60%)",
          pointerEvents: "none",
        }}
      />

      {/* === HEADER VARIANTS === */}
      {/* We show all 3 phase variants stacked for the mockup */}

      {Object.entries(PHASE_COLORS).slice(0, 3).map(([phase, col], idx) => (
        <div
          key={phase}
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(10,31,19,0.92)",
            borderBottom: `1px solid ${border}`,
            paddingTop: idx === 0 ? 56 : 16,
            paddingBottom: 12,
            paddingLeft: 16,
            paddingRight: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: idx < 2 ? 0 : 24,
          }}
        >
          {/* Left: Phase + End Game */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, alignItems: "flex-start" }}>
            <div
              style={{
                background: col.bg,
                borderRadius: 8,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 4,
                paddingBottom: 4,
                border: `1px solid ${col.border}`,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: col.text, letterSpacing: 1.5 }}>
                {col.label}
              </span>
            </div>
            <div
              style={{
                borderRadius: 6,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 3,
                paddingBottom: 3,
                border: `1px solid rgba(200,16,46,0.35)`,
                background: "rgba(200,16,46,0.08)",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: red, letterSpacing: 0.5 }}>⚑ End Game</span>
            </div>
          </div>

          {/* Center: Turn indicator */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            {idx === 0 ? (
              <div
                style={{
                  background: `linear-gradient(135deg, ${gold}, ${goldDim})`,
                  borderRadius: 10,
                  paddingLeft: 14,
                  paddingRight: 14,
                  paddingTop: 6,
                  paddingBottom: 6,
                  boxShadow: `0 0 12px rgba(200,155,60,0.4)`,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: "#0D2B1A", letterSpacing: 2 }}>YOUR TURN</span>
              </div>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700, color: text }}>DarkMage's Turn</span>
            )}
            <span style={{ fontSize: 11, color: textMuted }}>Turn {idx + 3}</span>
          </div>

          {/* Right: Vault + Life — BIGGER */}
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "rgba(200,155,60,0.12)",
                borderRadius: 12,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                border: `1px solid rgba(200,155,60,0.4)`,
                minWidth: 50,
                gap: 1,
              }}
            >
              <span style={{ fontSize: 11, color: gold, opacity: 0.7 }}>⚡ Vault</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: gold, lineHeight: 1 }}>7</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "rgba(200,16,46,0.12)",
                borderRadius: 12,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                border: `1px solid rgba(200,16,46,0.4)`,
                minWidth: 50,
                gap: 1,
              }}
            >
              <span style={{ fontSize: 11, color: red, opacity: 0.8 }}>♥ Life</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: red, lineHeight: 1 }}>3</span>
            </div>
          </div>
        </div>
      ))}

      {/* Board area — abbreviated */}
      <div style={{ flex: 1, padding: "0 16px", display: "flex", flexDirection: "column", gap: 12, position: "relative", zIndex: 1 }}>
        {/* Label callouts */}
        <div style={{ background: bgSurface, borderRadius: 10, padding: "10px 14px", border: `1px solid ${border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
            Color-coded phase badges
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(PHASE_COLORS).map(([p, c]) => (
              <div
                key={p}
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: c.text,
                  letterSpacing: 1,
                }}
              >
                {c.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: bgSurface, borderRadius: 10, padding: "10px 14px", border: `1px solid ${border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
            Bigger Life &amp; Vault display
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { icon: "♥", label: "Life", value: "3", color: red, bg: "rgba(200,16,46,0.12)", bdr: "rgba(200,16,46,0.4)" },
              { icon: "⚡", label: "Vault", value: "7", color: gold, bg: "rgba(200,155,60,0.12)", bdr: "rgba(200,155,60,0.4)" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  background: s.bg,
                  border: `1px solid ${s.bdr}`,
                  borderRadius: 14,
                  padding: "14px 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
                <span style={{ fontSize: 36, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontSize: 11, color: s.color, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${red}, #8B1A1A)`,
              border: "none",
              borderRadius: 14,
              padding: "16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              boxShadow: `0 4px 16px rgba(200,16,46,0.3)`,
            }}
          >
            <span style={{ fontSize: 16 }}>⚔️</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#FFF" }}>Attack!</span>
          </button>
          <button
            style={{
              flex: 1.2,
              background: `linear-gradient(135deg, ${gold}, ${goldDim})`,
              border: "none",
              borderRadius: 14,
              padding: "16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              boxShadow: `0 4px 16px rgba(200,155,60,0.3)`,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0D2B1A" }}>End Turn →</span>
          </button>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
