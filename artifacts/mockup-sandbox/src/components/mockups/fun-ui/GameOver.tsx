export function GameOver() {
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
      {/* ── VICTORY section ── */}
      <div
        style={{
          flex: 1,
          background: "linear-gradient(180deg, #0A0A0A 0%, #0F0A14 50%, #0A0A0A 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "44px 28px 20px",
          position: "relative",
          borderBottom: `1px solid ${border}`,
        }}
      >
        {/* Arcane confetti ✦ */}
        {[
          { t: 18, l: 28, s: 18, o: 0.5 },
          { t: 30, l: 80, s: 12, o: 0.3 },
          { t: 14, l: 200, s: 22, o: 0.4 },
          { t: 40, l: 310, s: 14, o: 0.35 },
          { t: 22, l: 350, s: 10, o: 0.25 },
        ].map((x, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: x.t,
              left: x.l,
              fontSize: x.s,
              color: gradStart,
              opacity: x.o,
              userSelect: "none",
            }}
          >
            ✦
          </span>
        ))}

        {/* Trophy */}
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            background: "rgba(200,160,200,0.08)",
            border: `1.5px solid rgba(200,160,200,0.3)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 52,
            marginBottom: 18,
            boxShadow: `0 0 40px rgba(180,130,200,0.25), 0 0 80px rgba(180,130,200,0.08)`,
          }}
        >
          🏆
        </div>

        {/* Victory title */}
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 52,
            fontWeight: 400,
            color: text,
            letterSpacing: 1,
            marginBottom: 8,
            textShadow: `0 0 40px rgba(200,160,200,0.4)`,
          }}
        >
          Victory!
        </div>

        <div style={{ fontSize: 15, color: textMuted, marginBottom: 18, textAlign: "center" }}>
          You conquered all challengers
        </div>

        {/* Card fan decoration */}
        <div style={{ display: "flex", gap: -8, marginBottom: 20, position: "relative", height: 60 }}>
          {["A♠", "K♥", "Q♦", "J♣", "10♠"].map((card, i) => (
            <div
              key={i}
              style={{
                width: 38,
                height: 54,
                background: "#F8F4E9",
                borderRadius: 5,
                border: "1px solid #DDD",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: i % 2 === 0 ? "#111" : red,
                transform: `rotate(${(i - 2) * 8}deg) translateY(${Math.abs(i - 2) * 4}px)`,
                position: "absolute",
                left: i * 32,
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              {card}
            </div>
          ))}
        </div>

        {/* Score strip */}
        <div
          style={{
            background: bgSurface,
            border: `1px solid ${border}`,
            borderRadius: 14,
            padding: "14px 24px",
            display: "flex",
            gap: 24,
            marginTop: 8,
          }}
        >
          {[
            { icon: "♥", label: "Life", val: "3", color: red },
            { icon: "⚡", label: "Vault", val: "5", color: gold },
            { icon: "🎴", label: "Rounds", val: "8", color: textMuted },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
              <div style={{
                fontFamily: "Georgia, serif",
                fontSize: 24,
                fontWeight: 400,
                color: s.color,
              }}>{s.val}</div>
              <div style={{ fontSize: 10, color: textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DEFEAT section ── */}
      <div
        style={{
          flex: 1,
          background: "linear-gradient(180deg, #0A0A0A 0%, #140A0A 60%, #0A0A0A 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 28px 16px",
        }}
      >
        {/* Skull */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            background: "rgba(200,16,46,0.08)",
            border: "1.5px solid rgba(200,16,46,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
            marginBottom: 12,
          }}
        >
          💀
        </div>

        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 36,
            fontWeight: 400,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 6,
            letterSpacing: 1,
          }}
        >
          Defeated
        </div>

        <div style={{ fontSize: 13, color: textMuted, marginBottom: 14 }}>
          WizardKing42 wins the match
        </div>

        {/* Winner badge */}
        <div
          style={{
            background: "rgba(200,160,80,0.08)",
            border: "1px solid rgba(200,160,80,0.25)",
            borderRadius: 20,
            padding: "8px 18px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 14 }}>🏆</span>
          <span style={{
            fontFamily: "Georgia, serif",
            fontSize: 15,
            color: gold,
          }}>WizardKing42</span>
        </div>

        {/* Buttons */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`,
              borderRadius: 32,
              padding: "18px 28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              cursor: "pointer",
              minHeight: 62,
              boxShadow: `0 4px 20px rgba(180,130,200,0.3)`,
            }}
          >
            <span style={{ fontSize: 18 }}>🔄</span>
            <span style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 18,
              fontWeight: 400,
              color: "#FFF",
            }}>Rematch</span>
          </div>
          <div
            style={{
              border: `1px solid ${border}`,
              borderRadius: 32,
              padding: "16px 28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              minHeight: 56,
            }}
          >
            <span style={{ fontSize: 16 }}>🏠</span>
            <span style={{ fontSize: 15, color: textMuted, fontWeight: 500 }}>Back to Lobby</span>
          </div>
        </div>
      </div>
    </div>
  );
}
