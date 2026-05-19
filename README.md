# fcPicker

A site that helps UAV builders pick the best flight controller (autopilot) board
for their build. Initial dataset is every ArduPilot-supported board, parsed
straight from the firmware's `hwdef` files. Schema is designed so PX4 / INAV /
Betaflight can be added later.

## How it works

```
~/ardupilot/.../hwdef/*           tools/build.py        frontend/public/boards.json
       (hwdef.dat / hwdef.inc) ──▶ (Python + SQLAlchemy) ──▶ (consumed by React UI)
                                          │
                                          └─▶ data/fcpicker.sqlite (intermediate)
```

The site is **fully static**. Python runs only at build time on your machine to
regenerate `boards.json`. Cloudflare Pages just serves the static React build.

## Local setup

Prerequisites: Node 20+, Python 3.11+, and a clone of [ArduPilot] at
`~/ardupilot` (only the `libraries/AP_HAL_ChibiOS/hwdef/` tree is needed).

```bash
# one-time
python3 -m venv .venv
.venv/bin/pip install -r tools/requirements.txt
cd frontend && npm install && cd ..

# regenerate the board catalog
.venv/bin/python tools/build.py

# run the site locally
cd frontend && npm run dev
```

## Project layout

```
fcpicker/
├── tools/
│   ├── build.py          # parses hwdef → SQLite → boards.json
│   └── requirements.txt
├── data/
│   └── fcpicker.sqlite   # generated, gitignored
├── frontend/
│   ├── public/boards.json   # generated, committed (so Cloudflare can build)
│   └── src/                 # React + Vite + TypeScript app
└── README.md
```

## Deployment (Cloudflare Pages)

Create a Pages project pointing at this repo with:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** `frontend`

`boards.json` is **committed to the repo** so Cloudflare's build env (which
doesn't run our Python pipeline) can find it. Regenerate locally and commit
whenever the ArduPilot hwdef sources change.

## Contact

Found a bug or have a board that's parsing incorrectly? Get in touch:

- GitHub: [@fredgaffey](https://github.com/fredgaffey) — open an issue on this repo
- Email: fredgaffey08@gmail.com

## Roadmap

- Manufacturer + pretty-name extraction from wiki pages
- Pinout: UART / CAN / PWM / I2C counts
- Vehicle-type and use-case wizard with scoring
- PX4 / INAV / Betaflight support

[ArduPilot]: https://github.com/ArduPilot/ardupilot
