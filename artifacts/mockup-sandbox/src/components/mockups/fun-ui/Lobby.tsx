export function Lobby() {
  const bg = "#0A0A0A";
  const bgCard = "#141414";
  const bgSurface = "#1C1C1C";
  const border = "#2A2A2A";
  const text = "#FFFFFF";
  const textMuted = "#888888";
  const gradStart = "#C8A0C8";
  const gradEnd = "#9080C8";
  const gold = "#C8A050";
  const red = "#C8102E";

  const GradPill = ({ children, full }: { children: React.ReactNode; full?: boolean }) => (
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
        width: full ? "100%" : undefined,
        minHeight: 62,
        boxShadow: `0 4px 24px rgba(180,130,200,0.35)`,
      }}
    >
      {children}
    </div>
  );

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
      {/* Hero section */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 32px 24px",
          position: "relative",
          gap: 0,
        }}
      >
        {/* Faint suit watermarks */}
        <div style={{ position: "absolute", top: 30, left: 20, fontSize: 120, color: "rgba(200,160,200,0.05)", lineHeight: 1, userSelect: "none" }}>♠</div>
        <div style={{ position: "absolute", bottom: 20, right: 10, fontSize: 140, color: "rgba(200,160,200,0.04)", lineHeight: 1, userSelect: "none" }}>♦</div>

        {/* Logo wordmark */}
        <div style={{ fontSize: 11, fontFamily: "system-ui", fontWeight: 700, color: textMuted, letterSpacing: 4, textTransform: "uppercase", marginBottom: 28 }}>
          MAGECARDGAME
        </div>

        {/* Big serif title */}
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 56,
            fontWeight: 400,
            color: text,
            lineHeight: 1.05,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Mage<br />Card<br />Game
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
          <div style={{ width: 40, height: 1, background: border }} />
          <span style={{ color: gradStart, fontSize: 14 }}>✦</span>
          <div style={{ width: 40, height: 1, background: border }} />
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 26,
            fontWeight: 400,
            color: gradStart,
            letterSpacing: 1,
            marginBottom: 28,
            opacity: 0.9,
          }}
        >
          Wizard Poker
        </div>

        {/* User badge */}
        <div
          style={{
            background: bgSurface,
            border: `1px solid ${border}`,
            borderRadius: 14,
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
          }}
        >
          <span style={{ fontSize: 24 }}>🧙</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: text }}>WizardPlayer42</div>
            <div style={{ fontSize: 11, color: textMuted }}>Signed in</div>
          </div>
          <span style={{ fontSize: 12, color: textMuted, cursor: "pointer" }}>Sign out</span>
        </div>

        {/* Suit strip */}
        <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
          {[
            { s: "♠", c: text },
            { s: "♥", c: red },
            { s: "♦", c: "#8090D0" },
            { s: "♣", c: text },
          ].map((x) => (
            <span key={x.s} style={{ fontSize: 22, color: x.c, opacity: 0.5 }}>{x.s}</span>
          ))}
        </div>
      </div>

      {/* CTA section — thumb zone */}
      <div style={{ padding: "12px 24px 48px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Join input */}
        <div
          style={{
            background: bgSurface,
            border: `1px solid ${border}`,
            borderRadius: 16,
            padding: "14px 18px",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div
            style={{
              flex: 1,
              fontSize: 24,
              fontFamily: "Georgia, serif",
              fontWeight: 400,
              color: gradStart,
              letterSpacing: 8,
              textAlign: "center",
            }}
          >
            ABCD
          </div>
          <div
            style={{
              background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`,
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 700,
              color: "#FFF",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Join →
          </div>
        </div>

        {/* Join Game outlined */}
        <div
          style={{
            border: `1px solid ${border}`,
            borderRadius: 32,
            padding: "18px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: "pointer",
            minHeight: 62,
          }}
        >
          <span style={{ fontSize: 20 }}>🎴</span>
          <span style={{ fontSize: 17, fontWeight: 600, color: text }}>Join a Game</span>
        </div>

        {/* New Game — primary CTA */}
        <GradPill full>
          <span style={{ fontSize: 20 }}>⚔️</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#FFF", letterSpacing: 0.3 }}>New Game</span>
        </GradPill>
      </div>
    </div>
  );
}
