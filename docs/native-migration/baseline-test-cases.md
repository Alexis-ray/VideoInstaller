# Web Baseline Test Cases

## Status

This file records what was verified during S00 and what still requires manual or later-stage native verification.

## Preconditions

- `npm install`: passed
- `npm run check`: passed via `node --check index.js`
- `npm start`: passed
- Configured tools found:
  - `C:\Tools\yt-dlp.exe`
  - `C:\Tools\ffmpeg\bin\ffmpeg.exe`
- Network access was sufficient for YouTube and Bilibili parse samples.

## Verified now

- [x] YouTube 普通视频链接解析
- [ ] YouTube Shorts 链接解析
- [ ] `youtu.be` 短链解析
- [x] Bilibili BV 链接解析
- [ ] Bilibili av 链接解析
- [ ] Bilibili `b23.tv` 短链解析
- [ ] Bilibili 多 P 视频解析
- [ ] Bilibili 分 P 切换
- [ ] Bilibili 番剧 `ep` 链接解析
- [ ] Bilibili 番剧 `ss` 链接解析
- [ ] Bilibili 合集 `ml` 链接解析
- [x] 原始格式下载
- [x] H.264 MP4 转码下载
- [ ] 单独音频下载
- [ ] 单独视频下载
- [x] 保存封面
- [x] 打开下载目录

## Automated evidence gathered in S00

- Health endpoint sample captured
- YouTube parse sample captured
- Bilibili parse sample captured
- Raw download polling sample captured
- Transcode polling sample captured
- Thumbnail stream and save behavior captured
- Open-folder sample captured
- Real output file tree captured from `tmp/AI vs Minesweeper/`
- Screenshots captured:
  - homepage
  - parse success
  - parse failure

## Remaining manual baseline gaps

- `downloading` UI screenshot
- `download completed` UI screenshot
- `download failed` UI screenshot
- All non-sampled URL families listed above
- Interactive part switching scenario
- Explicit single-audio and single-video UI clicks

## Blocking note for later stages

- S00 is usable as a migration baseline, but not every URL family was executed live during this pass.
- Native implementation should still add automated tests for the missing URL families in S05 and later end-to-end validation in S16.
