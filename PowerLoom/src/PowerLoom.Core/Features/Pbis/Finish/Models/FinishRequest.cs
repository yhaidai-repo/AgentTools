using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Features.Pbis.Finish.Models;

// How the PBI went (user decision 2026-10-05): the agents' rating 1–10, the hours the user spent, and what went wrong,
// if anything (logged as a WWW record; `Fault` Human or Agent, Agent by default).
public sealed record FinishRequest(int Rating, decimal EffortHours, string? WhatWentWrong, string? Fault, string? Actor, RecordWorkContext? Context = null);
