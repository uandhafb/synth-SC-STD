// The words of the presentation. THIS IS THE FILE TO EDIT.
//
// Each block is one "slide". Change the text between the quotes, save, reload the page (Cmd+R).
//   kicker  small line above the title
//   title   the big line
//   lines   the text; each line in quotes is one paragraph. `code` in backticks is shown as code,
//           **two stars** make a word stand out.
//   photo   a picture file in the folder  presentation/photos/  (for example "me.jpg"); null = none
//   scene   which Hydra visual plays behind it (the names are in scenes.js)
//   extra   a built-in piece: "schematic", "code", "mapping", "qr", "sections" (or nothing)
// Text in [SQUARE BRACKETS] is a placeholder, waiting for your own words.

export const BLOCKS = [
  {
    id: "title", kicker: "EAST 398 · 498", title: "CODESHAKE", scene: "paper",
    lines: ["a SuperCollider · Tidal · Strudel synthesizer, the Earth's movement data, and a room full of phones", "Uandha Fernandes Barbosa, BMus and BSc Eng"],
  },
  {
    id: "me", kicker: "who", title: "", scene: "figure", photo: "me.jpg",
    lines: [
      "BMus and BSc Eng · [YOUR PROGRAMME] · Concordia University, Montréal",
      "I research **live coding** and **embodied interaction**: how a body, an acoustic instrument and code can perform together in real time.",
      "[ONE OR TWO SENTENCES OF YOUR OWN ABOUT YOUR RESEARCH]",
      "This presentation is part of it: the blocks change when I raise my hand.",
    ],
  },
  {
    id: "tools", kicker: "the tools", title: "three languages, one instrument", scene: "three",
    lines: [
      "**SuperCollider** · the sound engine. The synthesizer is written and runs here.",
      "**TidalCycles** · a language for patterns. I type rhythm and melody; it sends them, note by note, to SuperCollider.",
      "**Strudel** · Tidal's sibling in the web browser. The same patterns play from both.",
      "Between them: **SuperDirt**, which receives each note as a message and starts a voice of the synth.",
    ],
  },
  {
    id: "began", kicker: "where it began", title: "a 1970s synthesizer, rebuilt in code", scene: "old",
    lines: [
      "The ARP 2600 (1971) is **semi-modular**: it makes sound with no cables at all, and every internal connection can be replaced with a patch cord.",
      "This project recreates that architecture in software, for live coding: three oscillators, noise, ring modulator, filter, envelopes, sample & hold, envelope follower, spring reverb.",
      "It models what each module **does**, tuned by ear and by measurement. It is not a simulation of the circuit, and it is not a copy of the panel.",
      "[HOW THE PROJECT BEGAN FOR YOU: WHY THIS SYNTH, WHAT YOU WANTED TO DO WITH IT]",
    ],
  },
  {
    id: "works", kicker: "how it works", title: "from a line of code to the speakers", scene: "marks", extra: "schematic",
    lines: ["Every one of the **107 parameters** can be set from the code, note by note. What the code does not set, the panel sets."],
  },
  {
    id: "code", kicker: "inside the code", title: "one line, one voice", scene: "feed", extra: "code",
    lines: ["Now in the editor: the synth's definition in SuperCollider, and this line in Tidal."],
  },
  {
    id: "piece", kicker: "from synth to piece", title: "the Earth plays it", scene: "shock", extra: "mapping",
    lines: [
      "Real earthquakes from the U.S. Geological Survey: **the last 24 hours, replayed in four minutes.**",
      "And under everything, the ground under Montréal, **live**, a few seconds ago.",
    ],
  },
  {
    id: "phones", kicker: "your turn", title: "your phone is a seismic station", scene: "arrive", extra: "qr",
    lines: [
      "Scan, tap **Join**, volume up, phone on the table.",
      "Each phone becomes a real station somewhere on Earth. An earthquake reaches each one at its own time: first the P wave, then the S wave. Some stations are in the shadow of the Earth's core and hear nothing.",
    ],
  },
  {
    id: "codeshake", kicker: "the piece", title: "CODESHAKE", scene: "shock", extra: "sections",
    lines: ["about four and a half minutes"],
  },
  {
    id: "thanks", kicker: "thank you", title: "questions?", scene: "figure", photo: "me2.jpg",
    lines: [
      "Movement vocabulary for the page: after **Joana Chicau**'s choreographic coding.",
      "Phones as an ensemble: after **Gabriel Vigliensoni**'s phase-study.",
      "Data: U.S. Geological Survey · EarthScope · Canadian National Seismograph Network. Text on the page: Wikipedia contributors.",
      "Built with SuperCollider, SuperDirt, TidalCycles, Strudel, Hydra.",
      "github.com/uandhafb/synth-SC-STD",
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
