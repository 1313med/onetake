# Optional cutaway stills

Drop theme stills here for Remotion plates when you want photo B-roll instead of pure UI mocks:

```
server/assets/cutaways/<theme>/<key>.jpg|png
```

Examples:
- `visa/passport.png` → `docMock` / cover still
- `food/tacos.png` → `foodPop` / brand art
- `marketing/desk.png` → `coverStory`

Files are copied into `server/remotion/public/cutaways/` at render time when present.
Comps always fall back to generated plates if a file is missing.
