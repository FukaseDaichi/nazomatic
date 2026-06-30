# NAZOMATIC — usage conventions

NAZOMATIC is a **dark-first** design system (shadcn/ui primitives, Tailwind utility
classes). Every component is on `window.NAZOMATIC.*` and is styled with **stock
Tailwind utility classes** — there is no separate prop-based theming layer.

## 1. Wrapping & setup (read this first)

- **Wrap the app root in `dark` + the brand surface.** The primitives default to
  their LIGHT appearance; the NAZOMATIC look only appears under a `.dark` ancestor:
  ```jsx
  <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white min-h-screen">
    {/* your screen */}
  </div>
  ```
  Without `dark` you get white cards on a white page. `text-white` (or `text-gray-50`)
  on the root is required — most primitives do not set their own text color.
- **Overlays portal to `document.body`.** `Dialog`, `Sheet`, `Select`, and (some)
  popovers render outside your `.dark` wrapper, so also put `dark` on `<html>` (e.g.
  `document.documentElement.classList.add('dark')`) — otherwise the portaled panel
  loses its dark styling. These panels set a dark *background* but NOT a text color;
  add `className="text-gray-50"` to the content when text looks invisible.
- **Tooltips need a provider:** wrap in `<TooltipProvider>` (once, high in the tree),
  then `Tooltip` / `TooltipTrigger asChild` / `TooltipContent`.

## 2. Styling idiom — Tailwind utilities, with the NAZOMATIC vocabulary

Style via `className` with these families (stock gray palette + purple accent):

| Purpose | Classes |
|---|---|
| Surfaces | `bg-gray-900` `bg-gray-800` `bg-gray-950` (cards/panels: `bg-gray-900/60`) |
| Brand surface | `bg-gradient-to-b from-gray-900 to-gray-800` |
| Text | `text-white` `text-gray-50` `text-gray-300` `text-gray-400` (muted) |
| **Accent (brand)** | bg `bg-purple-600` (hover `bg-purple-500`), text `text-purple-400` / `text-purple-300`, border `border-purple-400` |
| Borders / dividers | `border-gray-800` `border-gray-700` |
| Radius | `rounded-md` `rounded-lg` `rounded-full` (badges) |

- **⚠️ Brand color on `Button`/`Badge` backgrounds MUST include a `dark:` variant.**
  Their default variants set `dark:bg-gray-50` (light in dark mode), which overrides a
  bare `bg-purple-600` → the control renders WHITE. Always pair them:
  ```jsx
  <Button className="bg-purple-600 text-white hover:bg-purple-500
                     dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500">
    解答を送信
  </Button>
  ```
  Text-only purple (`text-purple-400`) needs no `dark:` — it works as-is.
- Prefer built-in variants before custom classes: `Button` has
  `variant="default|secondary|outline|ghost|link|destructive"` and
  `size="default|sm|lg|icon"`; `Badge` has `variant="default|secondary|destructive|outline"`.

## 3. Where the truth lives

- Stylesheet: `_ds/<folder>/styles.css` (imports `_ds_bundle.css` with the compiled
  utilities) — read it before inventing class names.
- Per-component API + usage: each component's `.d.ts` (props) and `.prompt.md`.

## 4. Compound components

`Card`, `Dialog`, `Sheet`, `Select`, `Table`, `Accordion`, `Tooltip` are compound —
compose the head with its sub-parts (e.g. `Card` + `CardHeader`/`CardTitle`/
`CardDescription`/`CardContent`/`CardFooter`; `Dialog` + `DialogContent`/`DialogHeader`/
`DialogTitle`/`DialogDescription`/`DialogFooter`). All sub-parts are on `window.NAZOMATIC`.

## Idiomatic example

```jsx
<div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
  <Card className="w-80 border-gray-800 bg-gray-900/60">
    <CardHeader>
      <CardTitle>謎解きイベント #12</CardTitle>
      <CardDescription>渋谷ナゾトキ街めぐり 2026</CardDescription>
    </CardHeader>
    <CardContent className="text-sm text-gray-300">制限時間90分・全5問。</CardContent>
    <CardFooter className="flex justify-between">
      <Badge variant="secondary">残り3問</Badge>
      <Button className="bg-purple-600 text-white hover:bg-purple-500
                         dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500">
        参加する
      </Button>
    </CardFooter>
  </Card>
</div>
```
