import localFont from "next/font/local";

/** LOJJ.io wordmark face (the "by LOJJ.io" in the logo lockup). */
export const lojjFont = localFont({
  src: "../../fonts/logo/LOGO.otf",
  weight: "400",
  style: "normal",
});

export const satoshi = localFont({
  src: [
    {
      path: "../../fonts/satoshi/Satoshi-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/satoshi/Satoshi-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/satoshi/Satoshi-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
});
