"use client";

import { useState } from "react";
import { cronText } from "@/lib/cronText";

// A schedule's cron with the same schedule in words under it (user decision 2026-10-18), posted as `name`. The input and
// its words are one part, so a field grid lines the input up with the controls beside it.
export function CronField({ label, value, name = "cron", hint, required = true }: { label: string; value: string; name?: string; hint?: string; required?: boolean }) {
  const [cron, setCron] = useState(value);

  return (
    <label className="field">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <span className="cron-control">
        <input name={name} value={cron} onChange={(event) => setCron(event.target.value)} required={required} />
        {cron.trim() !== "" && <span className="cron-words">{cronText(cron.trim())}</span>}
      </span>
    </label>
  );
}
