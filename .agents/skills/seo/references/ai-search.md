## AI search visibility (emerging)

AI search products differ in how they retrieve pages and control content use. Google Search AI features use the Google Search index; search visibility and model-training permissions are separate decisions. Check each provider's crawler documentation for the intended product before changing `robots.txt`.

- **Choose crawler controls by purpose.** Googlebot crawling and Google Search indexing/snippet controls apply to AI Overviews and AI Mode. `Google-Extended` controls some uses for Gemini training and grounding outside Google Search; it does not control inclusion or ranking in Google Search. Do not infer that blocking any AI-related user-agent removes all citations. See [Google Search AI features](https://developers.google.com/search/docs/appearance/ai-features) and [Google crawler controls](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended).
- **Lean on schema.org `Article`/`Product`/`FAQPage`.** AI summarizers parse structured data more reliably than they parse prose layouts. The examples in `.agents/skills/seo/references/structured-data.md` are the same ones that help here.
- **Make first-paragraph answers self-contained.** Both featured snippets and AI summaries pull short, coherent passages. A definition or direct answer in the first 1-2 sentences is more extractable than the same content buried under marketing prose.

### `llms.txt` — emerging, unproven

[`llms.txt`](https://llmstxt.org/) is a proposed convention (a Markdown index of your site's important pages, served at `/llms.txt`) for LLMs to consume. As of mid-2026 adoption is ~0.015% of sites and **no major AI vendor has confirmed they read it**. Treat it as a 5-minute speculative add for content sites — not a meaningful ranking or citation factor — and don't reorganize content around it.
