import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { fetchJoinPreview } from "@/lib/join-link";
import { siteOrigin } from "@/lib/site-origin";

export const JOIN_OG_SIZE = { width: 1200, height: 630 };

/** Card-style preview image for join links — title, subhead, hero background. */
export async function renderJoinOpenGraphImage(token: string) {
  const preview = await fetchJoinPreview(token);
  const origin = siteOrigin();
  const [satoshiBold, satoshiRegular] = await Promise.all([
    readFile(join(process.cwd(), "src/fonts/satoshi/Satoshi-Bold.woff2")),
    readFile(join(process.cwd(), "src/fonts/satoshi/Satoshi-Regular.woff2")),
  ]);

  const orgName = preview?.organization_name ?? "Your team";
  const title = preview?.valid
    ? `Join ${orgName} on Knohow`
    : "This invite link has expired";
  const subhead = preview?.valid
    ? preview.organization_domain
      ? `Sign in with your ${preview.organization_domain} account to get started.`
      : `Use this link to join ${orgName} on Knohow.`
    : "Ask whoever sent it for a new one.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "Satoshi",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${origin}/hero/signinbg.png`}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(160deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.48) 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            width: "100%",
            height: "100%",
            padding: "56px 64px",
            color: "white",
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: -0.5,
              opacity: 0.92,
              marginBottom: 18,
            }}
          >
            Knohow
          </div>
          <div
            style={{
              fontSize: 58,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.35,
              opacity: 0.94,
              maxWidth: 900,
            }}
          >
            {subhead}
          </div>
        </div>
      </div>
    ),
    {
      ...JOIN_OG_SIZE,
      fonts: [
        {
          name: "Satoshi",
          data: satoshiBold,
          weight: 700,
          style: "normal",
        },
        {
          name: "Satoshi",
          data: satoshiRegular,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );
}
