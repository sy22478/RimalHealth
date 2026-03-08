import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Rimal Health — Medication-assisted treatment for alcohol addiction";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0A2540 0%, #0c2e4e 60%, #0A2540 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 100px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "6px",
            height: "100%",
            background: "linear-gradient(180deg, #0284C7, #0ea5e9)",
          }}
        />

        {/* Brand name */}
        <div
          style={{
            fontSize: "36px",
            fontWeight: "700",
            color: "#0ea5e9",
            letterSpacing: "-0.5px",
            marginBottom: "24px",
          }}
        >
          Rimal Health
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: "800",
            color: "#ffffff",
            lineHeight: "1.1",
            letterSpacing: "-1px",
            marginBottom: "32px",
            maxWidth: "900px",
          }}
        >
          Quit or reduce drinking with medication that works.
        </div>

        {/* Sub-line */}
        <div
          style={{
            fontSize: "28px",
            color: "#94a3b8",
            lineHeight: "1.4",
            marginBottom: "48px",
          }}
        >
          California-licensed physician · Review in 24 hours · $50/month
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "16px" }}>
          {["No appointments", "FDA-approved medications", "HIPAA compliant"].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  background: "rgba(2, 132, 199, 0.15)",
                  border: "1px solid rgba(2, 132, 199, 0.4)",
                  borderRadius: "100px",
                  padding: "8px 20px",
                  fontSize: "20px",
                  color: "#7dd3fc",
                  fontWeight: "500",
                }}
              >
                {tag}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
