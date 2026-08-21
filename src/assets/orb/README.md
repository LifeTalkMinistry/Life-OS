# LIFE OS Orb Asset

This folder contains the production LIFE OS orb visual source.

Production asset:
- `life-os-orb.svg` — scalable orb artwork containing the dark sphere, optical rim lighting, atmospheric bloom, and floor reflection.

The former raster PNG has been removed. LIFE OS now renders the orb from the SVG while keeping interactive text and controls as real HTML layered above it, so NOW, WHY, TODAY, ADJUST, and Life Setup remain functional and accessible.

Vector workflow:
1. Preserve the approved orb reference as the visual source of truth.
2. Keep the sphere, rim lighting, bloom, and reflection as editable SVG gradients/filters.
3. Keep all product text and controls outside the artwork.
4. Preserve a true 1:1 interactive sphere at every viewport size.
