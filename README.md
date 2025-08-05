# Plank

Plank is a minimal app for calculating good parquet floor layouts. It could also be used for tiling layouts on floors or walls.

## How to use

- Draw a surface to mm scale
- Fill in your rectangular plank (or tile) size
- Place and rotate your first plank on the surface

## Layout

The app will then fill the surface with a layout by placing planks one at a time in row order. When starting a new row it will try to use the 'cut-off' from the previous row. It will keep track of all cut-offs made and reuse them if possible. There are rules that determines whether a cut-off can be re-used in a given position. These rules can be configured or turned off. 

## Checks

For a given layout the app can perform checks:

- Adjacent ends: Ends of planks on adjacent rows should not be close to each other (300mm threshold by default)
- A cut plank should not be smaller than 10mm in length or width

## Stats

For a given layout the app can provide:

- Number of planks required
- Area of planks required
- Area of surface
- Percentage of plank area wasted

