# Web Baseline Files

## Runtime directories

- App root: `D:\Files\Github\YoutubeVideoInstaller`
- Data root: `D:\Files\Github\YoutubeVideoInstaller`
- Tmp root: `D:\Files\Github\YoutubeVideoInstaller\tmp`

## Observed sample directory

- Sample folder: `tmp/AI vs Minesweeper/`

Observed contents:

```text
AI vs Minesweeper-h264.mp4
AI vs Minesweeper.f140.m4a
AI vs Minesweeper.f299.mp4
AI vs Minesweeper.info.json
AI vs Minesweeper.mp4
cover.jpg
```

## Directory layout rule

- All video-related files are stored under `tmp/<视频标题>/`.
- Folder name is sanitized from title.
- If title is empty, code falls back to `video id`.

## Observed file naming

### Raw merged output

- Example: `AI vs Minesweeper.mp4`

### Raw separate stream outputs

- Example audio stream: `AI vs Minesweeper.f140.m4a`
- Example video stream: `AI vs Minesweeper.f299.mp4`

### Transcoded output

- Example: `AI vs Minesweeper-h264.mp4`
- Stable suffix: `-h264.mp4`

### Cover output

- Example: `cover.jpg`
- Stable cover base name: `cover`
- Extension comes from source URL or content type, defaulting to `.jpg`

### Metadata output

- Example: `AI vs Minesweeper.info.json`
- API path mapping example: `info/AI vs Minesweeper/AI vs Minesweeper.info.json`

## API path mapping

- File download path prefix: `file/`
- Metadata path prefix: `info/`

Examples:

- `file/AI vs Minesweeper/AI vs Minesweeper-h264.mp4`
- `file/AI vs Minesweeper/cover.jpg`
- `info/AI vs Minesweeper/AI vs Minesweeper.info.json`

## Naming behavior summary

- Raw download can produce merged output or single-stream output depending on selected format and yt-dlp result.
- Transcoded output keeps the same readable title prefix and adds `-h264`.
- Cover output uses stable `cover.<ext>` naming.
- Metadata file uses yt-dlp's `*.info.json` naming.

## Migration notes

- Native desktop version should preserve:
  - `tmp/<title>/` root structure
  - stable `cover.<ext>` naming
  - stable `-h264.mp4` transcode suffix
  - preserved `*.info.json` metadata artifact
