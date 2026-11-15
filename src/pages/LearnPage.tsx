import { useMemo, useState } from "react";
import { EmptyState, PageHead, SectionTitle } from "../components/ui";
import {
  ARTICLES,
  ARTICLE_CATEGORIES,
  type Article,
  type ArticleCategory,
} from "../content/articles";

type Filter = "all" | ArticleCategory;

export function LearnPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Article | null>(null);

  const articles = useMemo(() => {
    const search = query.trim().toLowerCase();
    return ARTICLES.filter((article) => {
      const matchesCategory = filter === "all" || article.category === filter;
      const matchesSearch =
        !search ||
        article.title.toLowerCase().includes(search) ||
        article.content.join(" ").toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [filter, query]);

  if (selected) {
    return (
      <div className="page">
        <div className="breadcrumb">
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)} type="button">
            ← All articles
          </button>
        </div>
        <article className="card">
          <div style={{ fontSize: "2.2rem", marginBottom: 6 }} aria-hidden="true">
            {selected.emoji}
          </div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            {selected.title}
          </h1>
          <div className="muted" style={{ fontSize: "0.85rem", marginBottom: 20 }}>
            {ARTICLE_CATEGORIES[selected.category].label} · {selected.readMins} min read
          </div>
          <div className="article-body">
            {selected.content.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </article>

        <div className="card" style={{ marginTop: 16 }}>
          <SectionTitle>Keep reading</SectionTitle>
          <div className="related-grid">
            {ARTICLES.filter((article) => article.id !== selected.id)
              .slice(0, 3)
              .map((article) => (
                <button
                  key={article.id}
                  className="related-card"
                  onClick={() => setSelected(article)}
                  type="button"
                >
                  <span aria-hidden="true">{article.emoji}</span>
                  <span>
                    <span className="related-title">{article.title}</span>
                    <span className="muted related-meta">{article.readMins} min read</span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead
        title="Learn"
        sub="Building financial literacy — budgeting, saving, investing and staying safe from scams"
      />

      <div className="learn-toolbar">
        <div className="chip-row">
          <button
            className={`chip${filter === "all" ? " on" : ""}`}
            onClick={() => setFilter("all")}
            type="button"
            aria-pressed={filter === "all"}
          >
            All
          </button>
          {(Object.entries(ARTICLE_CATEGORIES) as [ArticleCategory, { emoji: string; label: string }][]).map(
            ([key, value]) => (
              <button
                key={key}
                className={`chip${filter === key ? " on" : ""}`}
                onClick={() => setFilter(key)}
                type="button"
                aria-pressed={filter === key}
              >
                {value.emoji} {value.label}
              </button>
            ),
          )}
        </div>
        <input
          className="learn-search"
          type="search"
          placeholder="Search articles…"
          aria-label="Search articles"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {articles.length === 0 ? (
        <div className="card">
          <EmptyState
            emoji="🔍"
            title="No articles found"
            subtitle="Try a different search or category."
            action={
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid cols-3">
          {articles.map((article) => (
            <button
              key={article.id}
              className="card article-card"
              onClick={() => setSelected(article)}
              type="button"
            >
              <div className="article-emoji" aria-hidden="true">
                {article.emoji}
              </div>
              <div className="article-title">{article.title}</div>
              <div className="muted article-meta">
                {ARTICLE_CATEGORIES[article.category].label} · {article.readMins} min read
              </div>
              <div className="muted article-preview">
                {article.content[0].slice(0, 110)}
                {article.content[0].length > 110 ? "…" : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
