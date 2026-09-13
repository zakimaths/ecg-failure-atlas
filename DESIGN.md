---
name: ECG Failure Atlas
description: Arcade Terminal design for an inspectable signal-processing demo.
colors:
  bg: "#0a0a0a"
  surface: "#111611"
  raised: "#192019"
  ink: "#e8ebdd"
  muted: "#a6b3a1"
  accent: "#33ff00"
  line: "#294329"
  control: "#63785d"
  reference: "#b68cff"
  output: "#ffb000"
  secondary: "#67dab4"
  grid: "#243124"
typography:
  display:
    fontFamily: '"Press Start 2P", ui-monospace, monospace'
    fontSize: "clamp(20px, 2.4vw, 28px)"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
  body:
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace'
    fontSize: "12px"
    fontWeight: 400
rounded:
  square: "0"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
  section: "32px"
  wide: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.square}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "10px 16px"
  profile-link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    height: "44px"
    width: "44px"
  experiment-current:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.square}"
  instrument:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.square}"
---

# Design System: ECG Failure Atlas

## Overview

**Creative North Star: "Arcade Terminal"**

Arcade Terminal frames a small signal-processing study with square controls, near-black surfaces and a restrained green interaction color. Pixel display type establishes the identity; readable monospace carries explanations, controls and measurements.

The waveform is the evidence. Its colors, axes and numeric results stay precise and unobstructed. Copy uses direct student/researcher language, describes the synthetic references and states the limits of each comparison.

**Key Characteristics:**
- Square frames and hard offset shadows.
- Local pixel display type paired with readable monospace.
- Green controls with separate scientific trace colors.
- A linear demo with responsive experiment navigation.

## Colors

Green interaction states sit against near-black surfaces, with distinct colors for scientific traces.

### Primary

- **Signal green (`accent`)** identifies selected experiments, selected settings, primary downloads, focus and small identity details.

### Secondary

- **Reference violet (`reference`)** identifies the synthetic reference waveform.
- **Output amber (`output`)** identifies transformed or difference signals and the first reported measurement.
- **Comparison mint (`secondary`)** identifies an additional comparison trace, also distinguished by a dotted line.

### Neutral

- **Near black (`bg`)** grounds the page and supplies text on bright controls.
- **Instrument black (`surface`)** fills plots and resting controls.
- **Raised green-black (`raised`)** separates instrument controls from the plotting area.
- **Warm white (`ink`)** carries primary text and the selected chart-view control.
- **Sage grey (`muted`)** carries supporting explanations, axis labels and control labels.
- **Frame green (`line`)** separates sections and forms hard shadows.
- **Control sage (`control`)** makes actionable boundaries and zero lines legible.
- **Plot grid (`grid`)** supports reading the data without competing with traces.

**The Signal Rule.** Reserve the reference, output and secondary trace colors for the plotted evidence and its matching legend or results. Do not recolor a trace when it becomes selected.

## Typography

**Display Font:** Press Start 2P, with monospace fallbacks.
**Body Font:** JetBrains Mono, with system monospace fallbacks.

Both families are bundled locally. The display is deliberately pixelated; body text remains regular and readable, with bold weight used for experiment titles and measurement hierarchy.

### Hierarchy

- **Display:** The project title uses the frontmatter display role. It reduces to (18px) below the narrow breakpoint and (16px) on the smallest screens.
- **Experiment title:** Bold monospace separates each experiment from the project introduction; it reduces from (24px) to (21px) on narrow screens.
- **Body:** The base role is used for the page. Explanations use generous line heights from (1.7) to (1.85), with narrower supporting text at (12px) or (13px).
- **Label:** Compact monospace identifies controls, legends and facts. Uppercase section labels use slight tracking, while sentences retain ordinary capitalization.
- **Measurements:** Tabular numbers use the body family. Desktop values are (36px), scaling to (32px) and (28px); units remain smaller and visually attached.

**The Reading Rule.** Use pixel type for the project identity. Keep explanations, controls, axis labels and numerical results in readable monospace.

## Layout

A centered container has a maximum width of (1248px), including (48px) horizontal padding on wide screens. The header aligns the identity left and profile links right. A linear project introduction leads into experiment navigation, the comparison, measured effects, observations, downloads and expandable methods.

The wide layout uses five equal experiment links and three result columns. Observations and downloads form two columns. At (1100px), horizontal padding becomes (32px). At (820px), it becomes (24px), navigation uses three columns and instrument controls stack. At (560px), page padding becomes (20px), experiment links form a contained horizontal scroller, results become full-width rows and supporting sections become one column. At (360px), page padding becomes (16px).

The spacing rhythm uses the frontmatter steps. Narrow screens reduce introductory spacing so the real signal appears early. Only the experiment strip scrolls horizontally; the page must fit the viewport.

## Elevation & Depth

Depth comes from three close surface tones, crisp boundaries and small hard shadows. There is no blur or ambient glow. Plots use their surface tone without a shadow on the traces themselves.

### Shadow Vocabulary

- **Selected control:** A (3px 3px 0) offset in frame green reinforces selected navigation and the primary download.
- **Instrument frame:** A (4px 4px 0) offset in frame green lifts the full comparison panel.

**The Hard Edge Rule.** Use crisp borders and small offset shadows to establish depth. Keep shadows away from plotted evidence.

## Shapes

Square corners, one-pixel borders and rectilinear grouping define the interface. Profile icons retain their recognizable SVG silhouettes inside square targets. Native checkbox marks remain recognizable. Separators, rather than additional cards, divide most explanatory content.

## Components

### Buttons

Primary downloads use green fill and dark text with a hard shadow. Secondary actions use the instrument surface and a visible border. Both use compact horizontal padding and a minimum height of (44px). Hover shifts the primary fill to warm white; secondary hover makes its text and border green. Pressed buttons move (1px) in both axes. Color and border transitions last (120ms).

Keyboard focus uses a green (2px) outline with (4px) offset. Disabled buttons reduce opacity to (0.5). Reduced-motion preferences remove transitions.

### Experiment navigation

Numbered links are square framed controls. The active link has a green fill, dark text and the selected-control shadow; hover raises its surface and brightens its border. Current-page semantics accompany color. Mobile navigation retains full labels in a contained horizontal scroller rather than shrinking all five links into a row.

### Chart view and settings

Overlay and Difference form a two-button group. The selected view is warm white with dark text. Prepared settings use native radio inputs with square visible labels; selected settings are green, with independent keyboard focus. Labels remain connected to their input and preserve normal radio keyboard behavior.

### Instrument and traces

The comparison panel groups its heading, view switch, trace visibility controls, plot, zoom reset and settings. Legend checkboxes and swatches use the corresponding trace color. Axis text uses readable monospace; plot data use full-resolution samples. The chart grows to its container and reduces height at narrower breakpoints. Difference mode hides the overlay legend; delay alignment appears only where applicable.

### Measurements

Three desktop columns use understated separators, large tabular values, smaller units and explanatory text. Mobile results stack in full-width rows with a separator beneath each. Amber emphasizes the first result without replacing its written label.

### Profile links

Top-right and footer links use the same square (44px) targets, inline SVG symbols and visible border. Green hover reverses the foreground to dark. Each has an accessible profile name and opens the supplied account in a new tab.

### Methods disclosure

A native details element separates methods from the main demonstration. Its summary has a generous target and green plus marker. Opening rotates that marker and reveals readable prose and a framed, wrapping replay command example. Focus remains visible.

## Do's and Don'ts

### Do:

- **Do** keep scientific trace colors consistent between the chart, legend and results.
- **Do** retain visible keyboard focus, explicit selected states and descriptive labels.
- **Do** use direct descriptions of experiments, measurements and reproducible results.
- **Do** present full-width result rows on narrow screens.

### Don't:

- **Don't** introduce a persistent application sidebar or dashboard chrome into this demo.
- **Don't** obscure waveforms with scan lines, glow or decorative animation.
- **Don't** use em dashes, simulated terminal activity or claims of diagnostic capability.
- **Don't** use pixel display type for body copy or numeric results.

## Custom experiment page

The custom page follows the same reading order as the reference demo: question, controls, signal, measurements, interpretation and reproducible evidence. Two numbered fieldsets represent the actual input and processing stages. Their four-column fields become two columns on smaller screens. Starting questions are ordinary buttons rather than a second navigation sidebar.

The large signal plot is followed by a clean-input comparison, FIR response and a cutoff sweep. Purple remains the reference, amber the processed signal and mint the processed clean branch. Error decomposition reuses those meanings. Native numeric fields and selects use the existing square boundaries and visible focus treatment. Downloads remain disabled while edits have not been calculated.

The sweep has a contained horizontal table on narrow screens. Only the table scrolls; the page and charts fit the viewport. Chart frames use outlines so their inner dimensions agree with the plotting library's measured width. The interface adds no decorative motion or remote assets.
