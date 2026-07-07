# Host Controls & Media Support — Design Spec

**Date:** 2026-07-07

## Summary

Extend «Своя игра» with host game selection, player removal (lobby only), exit/restart controls, and local media in questions.

## Decisions

| Topic | Choice |
|-------|--------|
| Game catalog | Multiple JSON files in `data/games/<id>/game.json` |
| Media storage | Local files relative to game folder (`media/…`) |
| Remove player | Lobby phase only |
| Exit | Return to `game_select`, players stay connected |
| Restart | Same game, reset scores and board, players stay |

## Architecture

- New phase `game_select` when no game is selected
- `server/gameCatalog.js` scans `data/games/` at startup
- Engine methods: `selectGame`, `restartGame`, `exitToGameSelect`, `removePlayer`
- Express serves `/games/:id/*` from `data/games/`
- Shared `QuestionMedia.vue` component on display/host

## Question Media Format

```json
{
  "value": 300,
  "text": "Кто этот космонавт?",
  "answer": "Юрий Гагарин",
  "media": {
    "image": "media/gagarina.jpg",
    "audio": "media/clip.mp3",
    "video": "media/clip.mp4"
  }
}
```

All `media` fields optional. Final-round themes support the same `media` object.

## Socket Events

| Event | Direction |
|-------|-----------|
| `host:selectGame` | client → server |
| `host:restartGame` | client → server |
| `host:exitToGameSelect` | client → server |
| `host:removePlayer` | client → server |
| `player:removed` | server → player |

Host view includes `availableGames` and `selectedGameId`.
