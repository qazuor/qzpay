# Archived Documentation

This directory contains the original planning documents that were reorganized into the new structured documentation.

## Contents

| File | Description | Size |
|------|-------------|------|
| `IDEA-BASE.md` | Original vision and concept document | ~36KB |
| `PDR.md` | Original Product Design Requirements (massive) | ~542KB |
| `ARCHITECTURE.md` | Original architecture specification | ~398KB |
| `DATA-MODEL.md` | Original database schema documentation | ~362KB |
| `IMPLEMENTATION-PLAN.md` | Original implementation roadmap with ~654 tasks | ~449KB |

## Why Archived?

These files were extremely large (some over 500KB) and contained:
- Duplicated content across documents
- Mixed concerns (ADRs in PDR, patterns mixed with schemas)
- No central index or navigation
- All phases mixed in single documents
- No progress tracking structure

## New Structure

The content has been reorganized into:

```
docs/
├── README.md                 # Main index with navigation
├── 01-vision/                # Vision, personas, value props
├── 02-requirements/          # Functional, non-functional, user stories
├── 03-architecture/          # Overview, patterns, security, resilience
├── 04-data-model/            # Tables, patterns, migrations
├── 05-api/                   # Public API, events, constants
├── 06-implementation/        # Roadmap and phase breakdowns
├── 07-adr/                   # Architecture Decision Records
└── examples/                 # Project integration examples
```

## Reference Only

These files are kept for reference only. All active documentation should be updated in the new structured directories.

**Do not modify these files.** If you find missing information, add it to the appropriate location in the new structure.
