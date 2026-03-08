import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Simple "R" monogram on navy background — matches brand
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "32px",
          height: "32px",
          background: "#0A2540",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          fontWeight: "800",
          fontSize: "20px",
          color: "#0ea5e9",
          letterSpacing: "-0.5px",
        }}
      >
        R
      </div>
    ),
    { ...size }
  );
}
