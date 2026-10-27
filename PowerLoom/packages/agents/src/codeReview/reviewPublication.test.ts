import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { PowerLoomDb } from "@powerloom/db";
import { commitReview } from "./commitReview";
import { commitBetterReview } from "../betterReview/commitBetterReview";

const url = process.env.POWERLOOM_ACCESS_TEST_DATABASE_URL;
it("serializes real review publishers and gates late, concurrent and legacy findings", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.pathname, "/synthetic_access");
  const namespace = `review_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url });
  const pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}` });
  try {
    await admin.query(`create schema ${namespace}`);
    await pool.query(`create table code_review(pr_id int primary key,status text default 'active',closed_reason text,reviewed_commit text,reviewed_iteration int,summary_md text,details jsonb,seen_comments jsonb,reviewed_at timestamptz,updated_at timestamptz);
      create table review_comment(id text primary key,pr_id int,run_id bigint,commit text,file_path text,start_line int,end_line int,severity text,category text,body_md text,code_snippet text,snippet_start_line int,status text default 'open',answer_md text,answered_at timestamptz,agent_reply_md text,created_at timestamptz default now(),updated_at timestamptz default now());
      create table code_review_version(id serial primary key,pr_id int,run_id bigint unique,reviewed_commit text,reviewed_iteration int,summary_md text,details jsonb,created_at timestamptz default now());
      create table agent_run(id bigint primary key,outputs jsonb default '[]');
      insert into code_review(pr_id) values(7); insert into agent_run(id) values(1),(2),(3),(4),(5);`);
    const db = drizzle(pool) as unknown as PowerLoomDb;
    const run = (comments = true): any => ({ context: { pr: { id: 7, sourceCommit: "head", origin: "github", iteration: 1 }, otherReviews: {}, previous: null, rules: { path: "review-rules/Synthetic.md" } }, checkout: { sourceCommit: "head" }, outdatedIds: [], draft: { updates: [], comments: comments ? [{ path: "a.ts", startLine: 1, endLine: 1, severity: "nit", body: "Synthetic finding", snippet: "x", snippetStartLine: 1 }] : [], rules: [], reviewerNotes: [], summary: "Ready to merge", result: { verdict: "ready", assessment: "Before a later draft mutation", goals: [], criteria: [], risks: [], notReviewed: [], businessLogic: "Synthetic" } } });
    const better = (r: any, id: number) => commitBetterReview({ db } as any, { id: "synthetic" } as any, r, id, []);
    // Closing cannot be undone by either publisher after it finishes running against an older context.
    await pool.query("update code_review set status='closed'");
    await assert.rejects(better(run(), 1), /is closed; publication refused/);
    await assert.rejects(commitReview(db, run(), 1), /is closed; publication refused/);
    assert.equal((await pool.query("select count(*)::int as n from review_comment")).rows[0].n, 0);
    assert.equal((await pool.query("select status from code_review")).rows[0].status, "closed");
    // An explicitly started new review reopens it; findings still downgrade approval.
    await pool.query("update code_review set status='active'");
    await better(run(), 1);
    let row = (await pool.query("select * from code_review")).rows[0];
    assert.equal(row.status, "active"); assert.equal(row.details.result.verdict, "not_ready");
    assert.equal((await pool.query("select count(*)::int as n from review_comment")).rows[0].n, 1);
    // Context saw no comments, but one was persisted by another publisher. Check current DB, not that context.
    await better(run(false), 2);
    assert.equal((await pool.query("select details from code_review")).rows[0].details.result.verdict, "not_ready");
    // Both writer implementations serialize allocation and never leave closed+unresolved or stale ready details.
    await Promise.all([better(run(), 3), commitReview(db, run(), 4)]);
    row = (await pool.query("select * from code_review")).rows[0];
    assert.equal(row.status, "active");
    assert.notEqual(row.details?.result?.verdict, "ready");
    assert.equal((await pool.query("select count(*)::int as n from review_comment")).rows[0].n, 3);
    await pool.query("update review_comment set status='fixed'");
    await better(run(false), 5);
    assert.equal((await pool.query("select details from code_review")).rows[0].details.result.verdict, "ready");
  } finally {
    await pool.end();
    await admin.query(`drop schema if exists ${namespace} cascade`).finally(() => admin.end());
  }
});
