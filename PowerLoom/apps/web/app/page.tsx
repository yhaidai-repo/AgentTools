import { redirect } from "next/navigation";

// The dashboard is the home page (user decision 2026-10-11); the Backlog is one click away in the menu.
export default function Home() {
  redirect("/dashboard");
}
