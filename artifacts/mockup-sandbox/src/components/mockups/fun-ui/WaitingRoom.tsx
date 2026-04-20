export function WaitingRoom() {
  const bg = "#0A0A0A";
  const bgCard = "#141414";
  const bgSurface = "#1C1C1C";
  const border = "#2A2A2A";
  const text = "#FFFFFF";
  const textMuted = "#888888";
  const gradStart = "#C8A0C8";
  const gradEnd = "#9080C8";
  const green = "#4CAF50";

  const players = [
    { name: "WizardKing42", isMe: true, isHost: true },
    { name: "DarkMage99", isMe: false, isHost: false },
    null,
    null,
  ];

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
      {/* Header */}
      <div
        style={{
          paddingTop: 56,
          paddingBottom: 16,
          paddingLeft: 20,
          paddingRight: 20,
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${border}`,
        }}
      >
        <div
          style={{
            width: 40, height: 40,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: textMuted, fontSize: 24, cursor: "pointer",
          }}
        >
          ‹
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 22,
              fontWeight: 400,
              color: text,
            }}
          >
            Waiting Room
          </div>
          <div style={{ fontSize: 11, color: textMuted, letterSpacing: 1, marginTop: 2 }}>
            WIZARD POKER
          </div>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Invite code */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 10, color: textMuted, letterSpacing: 3, textTransform: "uppercase" }}>
            Table Code
          </div>
          <div
            style={{
              background: bgSurface,
              border: `1px solid rgba(200,160,200,0.3)`,
              borderRadius: 16,
              padding: "20px 28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              boxShadow: `0 0 24px rgba(180,130,200,0.1)`,
            }}
          >
            <span
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 38,
                fontWeight: 400,
                color: gradStart,
                letterSpacing: 12,
              }}
            >
              XWQM
            </span>
            <span style={{ fontSize: 20, color: textMuted, cursor: "pointer" }}>⎘</span>
          </div>
          <div style={{ fontSize: 12, color: textMuted }}>Share this code with friends</div>
        </div>

        {/* Players */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: text }}>Players</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: green, boxShadow: `0 0 6px ${green}` }} />
              <span style={{ fontSize: 13, color: textMuted }}>2 / 4</span>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {players.map((p, i) => (
              <div
                key={i}
                style={{
                  width: "calc(50% - 5px)",
                  background: p ? bgSurface : "transparent",
                  border: `1px ${p ? "solid" : "dashed"} ${p ? (p.isMe ? "rgba(200,160,200,0.5)" : border) : border}`,
                  borderRadius: 14,
                  padding: "16px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  minHeight: 120,
                  boxShadow: p?.isMe ? `0 0 16px rgba(180,130,200,0.1)` : undefined,
                }}
              >
                {p ? (
                  <>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        background: p.isMe ? "rgba(200,160,200,0.1)" : bgCard,
                        border: `1.5px solid ${p.isMe ? gradStart : border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                      }}
                    >
                      🧙
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: p.isMe ? gradStart : text,
                        textAlign: "center",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {p.isMe && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: gradStart,
                            background: "rgba(200,160,200,0.12)",
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
                            color: textMuted,
                            background: bgCard,
                            padding: "2px 8px",
                            borderRadius: 6,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            border: `1px solid ${border}`,
                          }}
                        >
                          Host
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        background: bgCard,
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: textMuted, fontSize: 13, paddingTop: 4 }}>
            <span style={{ display: "inline-block" }}>◌</span>
            <span>Waiting for more players...</span>
          </div>
        </div>
      </div>

      {/* Footer CTA — thumb zone */}
      <div style={{ padding: "12px 24px 48px" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`,
            borderRadius: 32,
            padding: "20px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: "pointer",
            minHeight: 64,
            boxShadow: `0 4px 24px rgba(180,130,200,0.35)`,
          }}
        >
          <span style={{ fontSize: 20 }}>⚡</span>
          <span
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 19,
              fontWeight: 400,
              color: "#FFF",
              letterSpacing: 0.5,
            }}
          >
            Start Game
          </span>
        </div>
      </div>
    </div>
  );
}
