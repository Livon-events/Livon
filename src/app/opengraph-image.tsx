import { ImageResponse } from "next/og";

export const alt = "Livon — event discovery";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/** Default social preview image when a route does not set its own og:image. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          background: "#121212",
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          Livon
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 36,
            color: "#d11a8c",
            fontWeight: 600,
          }}
        >
          Discover events
        </div>
      </div>
    ),
    { ...size }
  );
}
