"use client";

import React from "react";

import type { VisualSpec } from "@/lib/engine/types";
import { Amortization } from "./Amortization";
import { Bond } from "./Bond";
import { Duration } from "./Duration";
import { Allocation, Curve, Flowchart, Growth, Series } from "./SimpleCharts";
import { Timeline } from "./Timeline";

export function VisualRenderer({ spec }: { spec: VisualSpec }) {
  switch (spec.kind) {
    case "timeline":
      return <Timeline {...spec} />;
    case "amortization":
      return <Amortization {...spec} />;
    case "bond":
      return <Bond {...spec} />;
    case "duration":
      return <Duration {...spec} />;
    case "flowchart":
      return <Flowchart {...spec} />;
    case "series":
      return <Series {...spec} />;
    case "allocation":
      return <Allocation {...spec} />;
    case "curve":
      return <Curve {...spec} />;
    case "growth":
      return <Growth {...spec} />;
  }
}
