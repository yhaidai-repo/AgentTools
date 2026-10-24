"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";

type ReportResult = (result: ActionResult) => void;

const RunNowReport = createContext<ReportResult | null>(null);

// The table's Run now buttons answer on one line under the table: a row's action cell is too narrow for the answer, so
// the button only marks it.
export function RunNowResults({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <RunNowReport.Provider value={setResult}>
      {children}
      {result && <p className="panel-body"><ResultLine result={result} /></p>}
    </RunNowReport.Provider>
  );
}

// Null outside a RunNowResults: the button then answers beside itself.
export function useRunNowReport(): ReportResult | null {
  return useContext(RunNowReport);
}
