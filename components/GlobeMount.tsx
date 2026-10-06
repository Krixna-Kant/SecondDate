"use client";

import dynamic from "next/dynamic";
import type { GlobeArc, GlobePerson } from "./GlobeStage";

const GlobeStage = dynamic(() => import("./GlobeStage").then((mod) => mod.GlobeStage), {
  ssr: false,
  loading: () => <div className="globe-loading">The globe is turning.</div>,
});

export function GlobeMount({ people, arcs }: { people: GlobePerson[]; arcs: GlobeArc[] }) {
  return <GlobeStage people={people} arcs={arcs} />;
}
