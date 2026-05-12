# Web Baseline UI

## Scope

This document records the current `v1.1.2` Web baseline before the native desktop migration starts.

## Runtime entry

- URL: `http://127.0.0.1:2878/`
- Browser title: `VideoInstaller v1.1.1 | Windows 本地视频解析下载器`
- Main title text: `VideoInstaller v1.1.1`
- Current package version: `1.1.2`
- Note: page title and visible version still show `v1.1.1`, while `package.json` is already `v1.1.2`.

## Layout

- Page width is centered with `max-width: 1200px`.
- Background uses light gray.
- Top area contains the app title and a GitHub icon link.
- Main input area contains one large URL input.
- Below the input is a status panel for info/success/error messages.
- Below the status panel is a static note explaining raw download vs H.264 MP4 transcode.
- Parse result area is hidden until parse succeeds.
- Result area contains title, source type badge, thumbnail, optional part selector, save-cover button, and download mode note.
- Two tables follow: audio formats and video formats.
- Bottom action area contains two main buttons: raw download and transcode download.
- There are modal wait panels for parsing, downloading, and transcoding.
- Footer area contains version description text, and `libjrt.js` appends a second dynamic footer with GitHub link and current time.

## Input and interaction

- Input element: `#url`
- Placeholder: `请输入 YouTube 或 Bilibili 视频 URL（可选原始下载或转码 H.264 MP4）`
- Input supports `Enter` submit through `<form onsubmit="parse(); return false;">`.
- Page auto-focuses the URL input on load.
- If query string contains `url`, page auto-fills it and auto-starts parse.

## Status area

- Element: `#statusPanel`
- Hidden by default.
- Supports three visual states:
  - `status-info`
  - `status-success`
  - `status-error`
- Supports multi-line and rich HTML content in success state.

## Result area

- Hidden until parse succeeds.
- Parse success updates:
  - result title
  - source type badge
  - thumbnail image
  - part selector when `parts.length > 0`
  - audio table rows
  - video table rows

## Audio table

- Columns:
  - `选择`
  - `格式ID`
  - `容器格式`
  - `码率`
  - `大小`
  - `详情`
  - `操作`
- Each row provides `仅下载此音频`.
- Best audio format is auto-selected.

## Video table

- Columns:
  - `选择`
  - `格式ID`
  - `容器格式`
  - `分辨率`
  - `原始编码`
  - `码率`
  - `大小`
  - `操作`
- Each row provides `仅下载此视频`.
- Best video format is auto-selected.
- 4K rows highlight resolution text.
- Codec is shown as a non-editable reference tag.

## Main actions

- Main buttons:
  - `下载已选格式（原始）`
  - `下载并转码（H.264 MP4）`
- Cover button:
  - `保存封面到视频目录`
- Main download requires one selected audio row and one selected video row.
- Single-stream download keeps standalone media files.

## GitHub behavior

- Top GitHub icon opens browser in a new tab.
- Dynamic footer GitHub link also opens browser.
- Current Web baseline does not support copy-only behavior.

## Error and progress behavior

- Parse start shows wait modal and info status.
- Parse failure shows inline error panel.
- Download flow polls every `2000ms`.
- Download phases shown in UI:
  - parsing
  - downloading
  - transcoding
  - completed
  - failed
- Thumbnail preview failure shows non-blocking info message.
- Download failure shows inline error panel.
- Open folder result is included in the success summary.

## Captured screenshots

- `docs/native-migration/screenshots/home.png`
- `docs/native-migration/screenshots/parse-success.png`
- `docs/native-migration/screenshots/parse-fail.png`

## Gaps in automated capture

- `downloading` state screenshot was not captured by headless browser because the page requires an interactive click to start download.
- `download completed` state screenshot was not captured by headless browser for the same reason.
- `download failed` state screenshot was not captured automatically.
- These states are still covered by real API samples in `baseline-api.md` and real file outputs in `baseline-files.md`.
