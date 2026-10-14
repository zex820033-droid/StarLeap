# 新增通用模式与客户档案 · 2026-10-14

Used user-selected Impeccable 4.5.2, extending the established visual world. Reused previously loaded project context, PRODUCT.md and current source/screenshot evidence. No new identity or image generation.

Two new sections follow the answer example: DeepSeek general mode with left copy/right screenshot, customer records with reversed desktop composition. Mobile retains semantic copy-before-image order. Each has one concise introduction, three capability labels and native details for supplementary facts. Existing feature navigation points to the new section; contextual links reach both additions and the library.

All five user screenshots are integrated without altering image pixels. Updated conversation, library and settings screens replace prior displayed versions; general and customer screenshots form the new sections. Original PNGs remain available in the existing viewer. Shared ProductScreen component emits three WebP sizes, alt/caption and preview hooks. The hero and Open Graph image use the updated conversation screen.

Privacy/FAQ copy reflects mode-specific sending: retrieved snippets and bound customer facts for knowledge mode; original input/images after send-preview confirmation for general mode; explicit authorization, default off, for contact names/phone numbers. These facts are taken from user-supplied screens and labels. Model-specific claims are not added.

Validation: pnpm build 0 errors/warnings/hints; static section/schema/local-resource checks passed. Contrast token checks pass: 30 text pairs minimum 7.47:1, 7 UI pairs minimum 4.33:1. Batched desktop/mobile visual review found no layout defects. Client/scroll widths match at 320/390/820/1440. General details respond to Enter; customer preview opens and Escape restores focus; settings preview displays the new image. Console error/warn logs empty. Existing ambient animation unchanged.

Evidence: review/new-features/desktop-general.jpg, desktop-customers.jpg, desktop-hero.jpg, mobile-general.jpg, mobile-customers.jpg, responsive.json, changes.diff and source-before/*.bak. Source diff reviewed. Metadata image was corrected in the final batch; final build passed. No deployment; lead form remains a demo.

Final result: passed.
