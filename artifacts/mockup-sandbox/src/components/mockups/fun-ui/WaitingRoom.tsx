export function WaitingRoom() {
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

  const players = [
    { name: "WizardKing42", isMe: true, isHost: true },
    { name: "DarkMage", isMe: false, isHost: false },
    { name: null, isMe: false, isHost: false },
    { name: null, isMe: false, isHost: false },
  ];

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
      {/* Felt gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(ellipse at 50% 30%, rgba(26,58,40,0.6) 0%, rgba(8,20,13,0.5) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: -40,
          fontSize: 220,
          color: "rgba(200,155,60,0.04)",
          lineHeight: 1,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        ♦
      </div>

      {/* Header */}
      <div
        style={{
          paddingTop: 56,
          paddingBottom: 16,
          paddingLeft: 20,
          paddingRight: 20,
          display: "flex",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
          borderBottom: `1px solid ${border}`,
        }}
      >
        <button
          style={{
            background: "none",
            border: "none",
            color: textMuted,
            fontSize: 24,
            cursor: "pointer",
            padding: 0,
            width: 40,
          }}
        >
          ‹
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: text, letterSpacing: 1 }}>Waiting Room</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            ♠ ♣ &nbsp;gathering players&nbsp; ♦ ♥
          </div>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Invite code */}
      <div style={{ padding: "20px 24px 0", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 10, color: textMuted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, textAlign: "center" }}>
          Invite Code
        </div>
        <div
          style={{
            background: bgSurface,
            borderRadius: 16,
            border: `1px solid ${gold}`,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: `0 0 20px rgba(200,155,60,0.12)`,
          }}
        >
          <span style={{ fontSize: 34, fontWeight: 800, color: gold, letterSpacing: 10 }}>XWQM</span>
          <span style={{ fontSize: 22, color: green, cursor: "pointer" }}>⎘</span>
        </div>
        <div style={{ fontSize: 12, color: textMuted, textAlign: "center", marginTop: 8 }}>
          Share this code with friends
        </div>
      </div>

      {/* Players section */}
      <div style={{ padding: "20px 24px 0", position: "relative", zIndex: 1, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: text }}>Players</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Live dot */}
            <div style={{ width: 8, height: 8, borderRadius: 4, background: green, boxShadow: `0 0 6px ${green}` }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: textMuted }}>2 / 4</span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {players.map((p, i) => (
            <div
              key={i}
              style={{
                width: "calc(50% - 6px)",
                background: p.name ? bgCard : "transparent",
                border: `1px ${p.name ? "solid" : "dashed"} ${p.name ? (p.isMe ? gold : border) : border}`,
                borderRadius: 16,
                padding: 16,
                minHeight: 110,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                boxShadow: p.isMe ? `0 0 16px rgba(200,155,60,0.15)` : undefined,
              }}
            >
              {p.name ? (
                <>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      background: p.isMe ? "rgba(200,155,60,0.15)" : bgSurface,
                      border: `1.5px solid ${p.isMe ? gold : border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                    }}
                  >
                    🧙
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: p.isMe ? gold : text, textAlign: "center" }}>
                    {p.name}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {p.isMe && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: gold,
                          background: "rgba(200,155,60,0.15)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        You
                      </span>
                    )}
                    {p.isHost && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: text,
                          background: bgSurface,
                          padding: "2px 8px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          border: `1px solid ${border}`,
                        }}
                      >
                        👑 Host
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      background: bgSurface,
                      border: `1px dashed ${border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      color: textMuted,
                    }}
                  >
                    +
                  </div>
                  <span style={{ fontSize: 12, color: textMuted }}>Waiting...</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Waiting indicator */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: textMuted,
            fontSize: 13,
          }}
        >
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
          <span>Waiting for more players...</span>
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{ padding: "16px 24px 40px", position: "relative", zIndex: 1 }}>
        <button
          style={{
            width: "100%",
            background: `linear-gradient(135deg, ${gold}, ${goldDim})`,
            border: "none",
            borderRadius: 16,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: "pointer",
            boxShadow: `0 4px 20px rgba(200,155,60,0.3)`,
          }}
        >
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#0D2B1A" }}>Start Game</span>
        </button>
      </div>
    </div>
  );
}
