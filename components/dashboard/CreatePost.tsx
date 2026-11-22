"use client";

import { useState, type FormEvent } from "react";
import { LuminousAvatar } from "@/components/icons/LuminousAvatar";
import { Toast } from "@/components/ui/Feedback";

export default function CreatePost() {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("UNIVERSITY");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: content.trim(), visibility }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Post could not be submitted.");
      setContent("");
      setMessage("Post submitted for moderation.");
      setToast("Sent for moderation");
      window.setTimeout(() => setToast(""), 3200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Post could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <form onSubmit={submit} className="surface-card spotlight-card reveal-item p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <LuminousAvatar name="One-Space" size="sm" />
        <div><p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Share with your community</p><p className="text-xs" style={{ color: "var(--text-secondary)" }}>Posts are visible after university moderation.</p></div>
      </div>
      <textarea aria-label="Post content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={5000} placeholder="What are you working on?" rows={3} className="form-input composer-input mt-4 resize-y" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}><label htmlFor="post-visibility">Visibility</label><select id="post-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)} className="form-input px-2 py-1"><option value="UNIVERSITY">University</option><option value="CONNECTIONS">Connections</option><option value="PRIVATE">Private</option></select><span aria-live="polite">{content.length}/5000</span></div>
        <button disabled={busy || !content.trim()} className="ui-button ui-button-primary magnetic-button">{busy ? <><span className="loading-dot" aria-hidden="true" /> Submitting…</> : "Submit post"}</button>
      </div>
      {message && <p role="status" className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>{message}</p>}
    </form>
    <Toast message={toast} />
    </>
  );
}
