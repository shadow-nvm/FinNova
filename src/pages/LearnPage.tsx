import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { EmptyState, PageHead, SectionTitle } from "../components/ui";
import {
  ARTICLES,
  ARTICLE_CATEGORIES,
  type Article,
  type ArticleCategory,
} from "../content/articles";

type Filter = "all" | ArticleCategory;

function useArticleProgress(active: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active]);

  return progress;
}

export function LearnPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Article | null>(null);
  const progress = useArticleProgress(Boolean(selected));

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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [selected]);

  if (selected) {
    const category = ARTICLE_CATEGORIES[selected.category];
    const related = ARTICLES.filter(
      (article) => article.id !== selected.id && article.category === selected.category,
    )
      .concat(ARTICLES.filter((article) => article.id !== selected.id))
      .filter((article, index, list) => list.findIndex((item) => item.id === article.id) === index)
      .slice(0, 3);

    return (
      <div className="page article-page">
        <div className="reading-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>

        <div className="breadcrumb">
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)} type="button">
            ← All guides
          </button>
        </div>

        <article className="card article-read">
          <header className="article-hero">
            <span className="article-hero-icon" aria-hidden="true">
              {selected.emoji}
            </span>
            <div className="article-hero-text">
              <div className="article-kicker">
                <span className="article-kicker-dot" style={{ background: "var(--brand-2)" }} />
                {category.emoji} {category.label}
                <span className="article-kicker-sep">·</span>
                {selected.readMins} min read
              </div>
              <h1 className="article-hero-title">{selected.title}</h1>
              <p className="article-hero-sub">{selected.content[0].slice(0, 160)}…</p>
            </div>
          </header>

          <div className="article-body">
            {selected.content.map((paragraph, index) => (
              <p key={index} style={{ "--i": index } as CSSProperties}>
                {paragraph}
              </p>
            ))}
          </div>

          {selected.takeaways && selected.takeaways.length > 0 && (
            <aside className="takeaways" aria-label="Key takeaways">
              <div className="takeaways-title">Key takeaways</div>
              <ul>
                {selected.takeaways.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </aside>
          )}
        </article>

        <div className="card" style={{ marginTop: 16 }}>
          <SectionTitle>Keep reading</SectionTitle>
          <div className="related-grid">
            {related.map((article, index) => (
              <button
                key={article.id}
                className="related-card"
                onClick={() => setSelected(article)}
                type="button"
                style={{ "--i": index } as CSSProperties}
              >
                <span aria-hidden="true">{article.emoji}</span>
                <span>
                  <span className="related-title">{article.title}</span>
                  <span className="muted related-meta">
                    {ARTICLE_CATEGORIES[article.category].label} · {article.readMins} min read
                  </span>
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
        sub={`${ARTICLES.length} short guides on budgeting, saving, investing and staying safe — written for real life, not textbooks`}
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
          placeholder="Search guides…"
          aria-label="Search guides"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {articles.length === 0 ? (
        <div className="card">
          <EmptyState
            emoji="🔍"
            title="No guides found"
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
        <div className="grid cols-3 learn-grid" key={filter}>
          {articles.map((article, index) => (
            <button
              key={article.id}
              className="card article-card"
              onClick={() => setSelected(article)}
              type="button"
              style={{ "--i": index } as CSSProperties}
            >
              <div className="article-card-top">
                <div className="article-emoji" aria-hidden="true">
                  {article.emoji}
                </div>
                <span className="article-mins">{article.readMins} min</span>
              </div>
              <div className="article-title">{article.title}</div>
              <div className="muted article-meta">{ARTICLE_CATEGORIES[article.category].label}</div>
              <div className="muted article-preview">
                {article.content[0].slice(0, 110)}
                {article.content[0].length > 110 ? "…" : ""}
              </div>
              <span className="article-cta">
                Read guide <span aria-hidden="true">→</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
