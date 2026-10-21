# UI system

One set of type, tag, button, radius and spacing rules for every public page. The rules live in the last
block of `theme.css` ("UI SYSTEM"). Same role = same settings. Change a value there and it changes everywhere.
The protected NDA case studies (`body.is-protected`) keep their own look.

## Type (desktop / phone)

| Role | Size | Weight | Used for |
|---|---|---|---|
| H1 hero | 56 / 36 | 400 | Home, Product Design, CRO Audit |
| H1 page or article | 40 / 32 | 400 | About, Contacts, Privacy, blog posts, case studies |
| H2 section | 36 / 28 | 400 | landing-page section titles |
| H2 article | 28 / 24 | 400 | headings inside articles and long pages |
| Feature title | 40 / 34 | 500 | the two service cards |
| H3 card or step | 24 / 22 | 500 | card, step, list and article-list titles |
| H3 sub-heading | 20 / 18 | 500 | small headings inside articles |
| Intro line | 18 / 17 | 400 | line under a section title |
| Hero lead | 19 | 400 | paragraph under the hero heading |
| Card body | 16 | 400 | text inside cards |
| Eyebrow label | 12.5 | 400 | small uppercase line, uppercase, 0.14em tracking |
| Button | 15 | 500 | 13px 26px padding, pill |
| Chip / filter tab | 15 | 500 | 9px 20px padding, pill, 1.5px border |

Headings use Playfair Display; everything else uses Lora.

## Corner radius
32 (hero and closing panels, contact panel, service cards, hero photo) · 24 (cards and panels) ·
16 (icon tiles, inputs, menus, small cards) · 12 (menu items, inner images) · pill (buttons, chips).
On phones the 32 steps down to 24.

## Spacing
Section to section 128 (88 on phones) · title to intro 16 · title block to content 56 (40 on phones) · card padding 32.

## Exceptions
Embedded mock-ups inside case studies (for example the UPDF pricing-page wireframe) keep the type of the page they imitate.
