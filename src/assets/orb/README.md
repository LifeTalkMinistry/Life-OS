# LIFE OS Orb Asset

This folder is reserved for the production LIFE OS orb visual source.

Planned production asset:
- `life-os-orb.svg` — scalable orb artwork, including the sphere and optical rim lighting.

The interactive text and controls remain real HTML layered above the orb so NOW, WHY, TODAY, ADJUST, and Life Setup stay functional and accessible.

Source-image workflow:
1. Use the approved high-resolution orb reference as the visual source of truth.
2. Reconstruct the sphere as scalable vector/gradient artwork rather than embedding UI text into the image.
3. Keep floor reflection / atmospheric glow separable where useful for responsive positioning.
4. Preserve a true 1:1 sphere at every viewport size.
