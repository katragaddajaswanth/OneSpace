"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Feedback";

type FeedPost = {
  id: string; content: string; visibility: string; createdAt: string; likedByMe: boolean;
  author: { id: string; fullName: string; primaryRole: string; unifiedProfile?: { photoUrl: string | null } | null };
  _count: { likes: number; comments: number };
  comments: Array<{ id: string; content: string; createdAt: string; user: { id: string; fullName: string } }>;
};

export default function UniversityFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/feed?page=1&limit=10", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Feed could not be loaded.");
      setPosts(data.posts ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Feed could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function toggleLike(post: FeedPost) {
    const response = await fetch(`/api/feed/${encodeURIComponent(post.id)}/like`, { method: post.likedByMe ? "DELETE" : "POST" });
    if (response.ok) setPosts((current) => current.map((item) => item.id === post.id ? { ...item, likedByMe: !item.likedByMe, _count: { ...item._count, likes: item._count.likes + (item.likedByMe ? -1 : 1) } } : item));
    else setError("Like could not be updated. Please retry.");
  }

  async function submitComment(post: FeedPost) {
    const content = commentDrafts[post.id]?.trim();
    if (!content) return;
    const response = await fetch(`/api/feed/${encodeURIComponent(post.id)}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (response.ok) { setCommentDrafts((value) => ({ ...value, [post.id]: "" })); await load(); }
    else setError("Comment could not be added. Please retry.");
  }

  return <section>
    <div className="mb-3 flex items-center justify-between"><div><h3 className="text-[17px] font-semibold" style={{ color: "var(--foreground)" }}>University feed</h3><p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>Approved conversations and updates from your community</p></div><Link href="/communities" className="action-control action-control-tertiary">Communities</Link></div>
    {loading ? <div className="space-y-4"><div className="surface-card p-5"><Skeleton className="h-10 w-40" /><Skeleton className="mt-5 h-4 w-full" /><Skeleton className="mt-2 h-4 w-4/5" /><Skeleton className="mt-5 h-8 w-32" /></div><div className="surface-card p-5"><Skeleton className="h-10 w-36" /><Skeleton className="mt-5 h-4 w-full" /></div></div> : error ? <div className="surface-card p-6"><p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p><button onClick={() => void load()} className="mt-3 text-sm font-semibold" style={{ color: "var(--accent)" }}>Retry</button></div> : posts.length === 0 ? <p className="surface-card p-6 text-sm" style={{ color: "var(--text-secondary)" }}>No approved posts yet.</p> : <div className="space-y-4">{posts.map((post) => <article key={post.id} className="surface-card spotlight-card reveal-item p-5">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-sm font-bold" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>{post.author.unifiedProfile?.photoUrl ? <img src={post.author.unifiedProfile.photoUrl} alt="" className="h-full w-full object-cover" /> : post.author.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</div><div><Link href={`/profiles/${encodeURIComponent(post.author.id)}`} className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{post.author.fullName}</Link><p className="text-xs" style={{ color: "var(--text-secondary)" }}>{post.author.primaryRole.replaceAll("_", " ")}</p><time className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{new Date(post.createdAt).toLocaleString()}</time></div></div>
      {post.content && <p className="mt-4 whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--foreground)" }}>{post.content}</p>}
      <div className="mt-5 flex flex-wrap gap-5 border-t pt-4 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><button onClick={() => void toggleLike(post)} style={{ color: "var(--accent)" }}>{post.likedByMe ? "♥ Liked" : "♡ Like"} · {post._count.likes}</button><span>Comments · {post._count.comments}</span></div>
      {post.comments.map((comment) => <div key={comment.id} className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-secondary)" }}><b style={{ color: "var(--foreground)" }}>{comment.user.fullName}</b><p className="mt-1" style={{ color: "var(--text-secondary)" }}>{comment.content}</p></div>)}
      <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void submitComment(post); }}><input aria-label="Write a comment" value={commentDrafts[post.id] ?? ""} onChange={(event) => setCommentDrafts((value) => ({ ...value, [post.id]: event.target.value }))} maxLength={2000} className="form-input min-w-0 flex-1 px-3 py-2" placeholder="Write a comment…" /><button className="ui-button ui-button-secondary px-3">Comment</button></form>
    </article>)}</div>}
  </section>;
}
