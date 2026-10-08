// The words of the presentation. THIS IS THE FILE TO EDIT.
//
// Each block is one "slide". Change the text between the quotes, save, reload the page (Cmd+R).
//   kicker  small line above the title
//   title   the big line
//   lines   the text; each line in quotes is one paragraph. `code` in backticks is shown as code,
//           **two stars** make a word stand out.
//   photo   a picture file in the folder  presentation/photos/  (for example "me.jpg"); null = none
//   credit  the line under the photo (who took it)
//   qr      a web address shown as a QR code beside the text (for example the project on GitHub)
//   dense   true = slightly smaller text, for a block with many lines
//   {Strudel|strudel.cc} is a name you can click: it opens that page, and gets a small arrow ↗
//   "→ strudel.cc" in a line also becomes a link to that page
//   scene   which Hydra visual plays behind it (the names are in scenes.js)
//   extra   a built-in piece: "schematic", "code", "mapping", "qr", "sections" (or nothing)
// Text in [square brackets] is shown in pink, with its brackets. In CAPITALS it is a placeholder,
// waiting for your own words.

export const BLOCKS = [
  {
    id: "title", kicker: "EAST 398 · 498", title: "CODESHAKE", scene: "paper",
    lines: ["a SuperCollider · Tidal · Strudel synthesizer, the Earth's movement data, and a room full of phones", "[Uandha Fernandes Barbosa, BMus and BSc Eng]"],
  },
  {
    id: "me", kicker: "who", title: "", scene: "figure", photo: "me.jpg", credit: "photo: Nicolas Morales-Sanabria",
    lines: [
      "Master of Arts and Technology candidate · Concordia University",
      "I research **live coding**, **human-computer interaction and embodiment** and **machine learning**.",
      "[What is live coding?] It is the practice of creating music, visuals or web choreography with the code on screen for everyone to see.",
      "This presentation is an example: made with **Hydra**, JavaScript and **MediaPipe**, which reads my hands through the camera.",
    ],
  },
  {
    id: "tools", kicker: "the languages", title: "", scene: "three", dense: true,
    lines: [
      "{JavaScript|developer.mozilla.org/docs/Web/JavaScript} [1995 · web choreography] the programming language of web pages, and it can be used for web choreography.",
      "{SuperCollider|supercollider.github.io} [1996 · sound] a language for sound synthesis, developed by James McCartney. Free and open source.",
      "{TidalCycles|tidalcycles.org} [2009 · sound] a live coding environment for algorithmic patterns, written in Haskell. Free and open source; it inspired the Uzulangs, including the web-based Strudel.",
      "{Hydra|hydra.ojack.xyz} [2018 · visuals] a live coding environment for visuals in the web browser, created by Olivia Jack and inspired by analog modular video synthesizers. Free and open source.",
      "{Strudel|strudel.cc} [2022 · sound] the official port of the TidalCycles pattern language to JavaScript. Free, web-based and open source.",
    ],
  },
  {
    id: "began", kicker: "where it began", title: "a 1970s synthesizer that inspired my coded synth", scene: "old",
    photo: "synth.jpg", credit: "Dalhousie University, 2024 fall term",
    lines: [
      "The ARP 2600 is a legendary semi-modular analog synthesizer, introduced in 1971.",
      "My idea was to build a coded synth in SuperCollider, where I can curate sounds and live code with them in Tidal and Strudel.",
    ],
  },
  {
    id: "works", kicker: "how it works", title: "", scene: "marks", extra: "schematic", dense: true,
    lines: ["**3 synth definitions · 21 modules · 107 parameters**"],
  },
  {
    id: "code", kicker: "inside the code", title: "", scene: "glyphs", extra: "code",
    lines: ["Now in the editor: the synth's definition in SuperCollider, and this line in Tidal."],
  },
  {
    id: "thanks", kicker: "thank you", title: "questions?", scene: "ripples", qr: "github.com/uandhafb/synth-SC-STD",
    lines: [
      "The visuals behind this text are moved by **real data**: the ground under Montréal, live, a few seconds ago. Every earthquake sends a wave through them.",
      "Data: U.S. Geological Survey · EarthScope · Canadian National Seismograph Network.",
      "Built with SuperCollider, TidalCycles, Strudel, Hydra.",
    ],
  },
];

// Questions someone may ask. Not part of the sequence: press Q to open the list, then the number.
// `where` is the file to open if they want to see it.
export const QA = [
  { q: "Where are the synth definitions? Did you build them in SuperCollider?",
    a: ["Yes. The whole synth is written in SuperCollider's own language, from its basic building blocks (oscillators, filters, envelopes). No samples, no plug-in.",
        "Each module is a small function; the voice connects them in the default routing; the reverb is separate, shared by all voices."],
    where: "sc/synthdefs/00_modules.scd (the modules) · scstd.scd (the voice) · spring.scd (the reverb)" },
  { q: "Is it a simulation of the original circuit?",
    a: ["No. It is behavioural modelling: each module does what the original module does, and is tuned by ear and by measurement.",
        "The filter is a ladder model with saturation; the oscillators are band-limited so they do not alias; each one drifts slowly and independently, like analog oscillators do."],
    where: "docs/modules.md · docs/references/calibration.md" },
  { q: "How does Tidal talk to the synth?",
    a: ["Tidal turns the pattern into messages (OSC), one per note, with the note and every parameter I typed.",
        "SuperDirt, inside SuperCollider, receives each message and starts one voice of the synth for it. In mono mode the messages steer one voice that never stops, which gives real glide."],
    where: "tidal/params.hs (the parameter names) · sc/synthdefs/scstd.scd" },
  { q: "107 parameters: how do you keep track?",
    a: ["Every name starts with its module: `o1…` oscillator 1, `vcf…` filter, `e…` envelope, `sp…` spring reverb.",
        "One document lists them all, and Tidal, Strudel and the panel are generated or checked against it.",
        "The rule: a value in the pattern wins; with no value, the panel decides."],
    where: "docs/params.md" },
  { q: "Where does the earthquake data come from? Is it live?",
    a: ["Earthquakes: the public feeds of the U.S. Geological Survey. The piece replays the last 24 hours; in the last section it plays whatever is reported while we listen (about 1 to 5 minutes after it happens).",
        "The moving line and the soft noise are truly live: the seismometer in Montréal (station CN.MNTQ), through EarthScope, a few seconds late."],
    where: "performance/quake-relay.js · docs/quakes/lib/ground.js" },
  { q: "How do the phones know when to sound?",
    a: ["Every phone gets the same small message: where the earthquake was, how big, how deep.",
        "Each phone knows which station it is, works out its distance, and looks up how long the P and S waves take to travel that far through the Earth (standard travel-time tables). One real minute is 0.4 seconds here.",
        "Between 104° and 140° away the core blocks the waves: the shadow zone."],
    where: "docs/quakes/phone.js · docs/quakes/lib/geo.js" },
  { q: "How is the Wikipedia page being moved?",
    a: ["The program on my laptop fetches the real page and adds one script to it. The script has a small vocabulary of movements (shake, fall, crack, incline, breathing), and each earthquake is translated into calls of them, shown as code at the bottom.",
        "Letters that fall stay fallen, and images that crack stay cracked, until the day is replayed again."],
    where: "performance/web/choreo.js" },
  { q: "What is yours here, and what is reused?",
    a: ["Mine: the synthesizer, the mapping from earthquakes to sound and movement, the piece, the phone instrument, this presentation.",
        "Reused, all open source: SuperCollider, SuperDirt, TidalCycles, Strudel, Hydra, a hand-tracking model, a QR code library, public map and earthquake data.",
        "Ideas I am in debt to: Joana Chicau, Gabriel Vigliensoni.",
        "[HOW YOU WORKED AND WHICH TOOLS HELPED YOU WRITE THE CODE, IN YOUR OWN WORDS]"],
    where: "README.md" },
  { q: "How are the slides controlled?",
    a: ["The laptop's camera. A hand-tracking model running in the browser finds my hands; one open hand held for a moment goes forward, two go back.",
        "Nothing leaves the laptop: the camera image is only read here, and mixed into the visuals."],
    where: "performance/web/presentation/gesture.js" },
  { q: "What comes next?",
    a: ["An acoustic instrument driving it: a cello through the envelope follower, opening the filter in real time.",
        "A keyboard controller, and the panel inside the code editor.",
        "[YOUR OWN NEXT STEPS FOR THE RESEARCH]"],
    where: "CLAUDE.md, the list of stages" },
];
