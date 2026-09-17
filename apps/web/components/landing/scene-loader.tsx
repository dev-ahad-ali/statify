"use client";

import dynamic from "next/dynamic";

const Scene = dynamic(() => import("./scene"), { ssr: false });

export function SceneLoader({ variant }: { variant: "hero" | "background" | "cta" }) {
  return <Scene variant={variant} />;
}
