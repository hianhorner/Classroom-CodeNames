```markdown
# Design System Document: The Tactile Intellectual

## 1. Overview & Creative North Star
The **Creative North Star** for this design system is **"The Curated Tabletop."** 

We are moving away from the "app-like" sterility of standard digital interfaces and toward the warmth of a premium, physical board game experience. This system avoids the "template" look by treating the screen not as a flat grid of pixels, but as a physical surface where objects have weight, texture, and spatial relationships.

The aesthetic is **Tactile Minimalism**. We achieve sophistication through "intentional asymmetry" and "tonal layering." By utilizing a restricted palette of warm neutrals and high-contrast editorial typography, we create an environment that feels both intellectually stimulating and approachable.

---

## 2. Colors & Surface Philosophy

Our palette is rooted in organic, paper-like tones (`surface`) and academic accents (`primary`/`secondary`).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections or containers. Boundaries must be established through background color shifts or subtle tonal transitions.
*   *Example:* A `surface-container-low` component should sit directly on a `surface` background. The shift in hex value provides the edge; a line would only clutter the "tabletop."

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked sheets of fine cardstock. Use the following tiers to define depth:
*   **Base Layer (The Board):** `surface_dim` (#e6d8c9).
*   **Sectional Layer:** `surface_container` (#faecdc).
*   **Active Component (The Tile):** `surface_container_lowest` (#ffffff) or `surface_variant` (#eee0d1).

### The Glass & Texture Principle
While the user requested "no gradients," we interpret this as "no glossy, skeuomorphic gradients." To move beyond a basic flat look, use **Glassmorphism** for floating overlays (e.g., game menus). Use `surface` colors at 80% opacity with a `20px` backdrop-blur to allow the "board" colors to bleed through, softening the interface.

---

## 3. Typography
We utilize a dual-typeface system to balance editorial authority with functional clarity.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "boutique" feel. Use `display-lg` for game states (e.g., "Red Team Wins") with tight tracking to mimic high-end book covers.
*   **The Tile & Body (Inter):** The workhorse. Inter provides maximum legibility for the word-association mechanics.
    *   **Tiles:** Use `title-lg` or `headline-sm` in **Bold**. The text should feel heavy and grounded on the tile surface.
    *   **Labels:** Use `label-md` for metadata (e.g., "Clues remaining") to keep the UI from feeling "noisy."

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Stacking** rather than structural shadows.
*   Place `primary_fixed` elements on `surface_container_highest` to create a "pressed" look.
*   Place `surface_container_lowest` tiles on a `surface_dim` board to create a natural "lift."

### Ambient Shadows
When an element must "float" (like a selected tile or a modal), use a signature ambient shadow:
*   **Token:** `rgba(33, 26, 17, 0.06)` (A tinted version of `on-surface`).
*   **Style:** `0px 12px 32px`. Avoid dark grey shadows; the tint must match the warm board background to mimic natural tabletop lighting.

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., a focused state), use a **Ghost Border**: `outline_variant` (#cfc5bb) at 30% opacity. Never use 100% opaque lines.

---

## 5. Components

### The Game Tile (The Signature Component)
*   **Background:** `surface_container_lowest` (#ffffff).
*   **Corner Radius:** `md` (0.75rem).
*   **Typography:** `title-lg`, centered, `on_surface` (#211a11).
*   **Interaction:** On hover, shift background to `surface_variant`. On selection, use a `2px` "Ghost Border" of the team color (`primary` or `secondary`).

### Buttons (Tactile CTAs)
*   **Primary:** `primary` (#ae2f31) with `on_primary` (#ffffff) text.
*   **Secondary:** `surface_container_high` (#f4e6d7) with `on_surface` text.
*   **Shape:** `full` (pill-shaped) for action buttons to contrast against the rectangular tiles.
*   **Padding:** `spacing.3` (top/bottom) and `spacing.6` (left/right).

### Chips (Game Metadata)
*   Use for "Active Players" or "Categories."
*   **Style:** `surface_container_low` background with `label-md` text. No border.

### Input Fields
*   **Style:** Understated. Use `surface_container_highest` with a bottom-only "Ghost Border."
*   **Focus:** Transition the bottom border to `primary` (#ae2f31).

### Cards & Lists
*   **Rule:** Forbid divider lines.
*   **Separation:** Use `spacing.5` (1.7rem) of vertical whitespace or a subtle background shift to `surface_container_low`.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins. If a header is left-aligned, allow the game board to be slightly offset to create an editorial, "un-templated" feel.
*   **Do** use the `spacing.8` and `spacing.10` values for large breathing rooms between the "Board" and the "UI Controls."
*   **Do** ensure team colors (`primary` for Red, `secondary` for Blue) are used only for game-critical elements to maintain their impact.

### Don't
*   **Don't** use pure black (#000000) for anything. Use `on_surface` (#211a11) or `on_background` for a softer, premium feel.
*   **Don't** use `0.5rem` (default) radii for everything. Use `xl` (1.5rem) for large containers and `md` (0.75rem) for tiles to create a hierarchy of "roundness."
*   **Don't** use standard "drop shadows" on text. High contrast between `on_surface` and `surface_container_lowest` is sufficient for legibility.

---

## 7. Interaction Motion
*   **The "Paper Slide":** When a tile is revealed, it should not "pop" in. It should slide 4px upward with a `cubic-bezier(0.2, 0.8, 0.2, 1)` easing, mimicking a card being flipped on a felt table.
*   **Tonal Transitions:** All hover states should be soft fades (200ms) rather than instant color flips.```