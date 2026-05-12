# Web Baseline API

## Environment

- Server: `http://127.0.0.1:2878`
- Package version: `1.1.2`
- Runtime mode: `portable`
- Tool paths from `config.json`:
  - `C:/Tools/yt-dlp.exe`
  - `C:/Tools/ffmpeg/bin/ffmpeg.exe`

## Health sample

Request:

```text
GET /y2b/health
```

Observed response sample:

```json
{"success":true,"result":{"name":"VideoInstaller","version":"1.1.2","platform":"win32","windowsOptimized":true,"port":2878,"address":"127.0.0.1","runtime":{"mode":"portable","configPath":"D:\\Files\\Github\\YoutubeVideoInstaller\\config.json","appRootDir":"D:\\Files\\Github\\YoutubeVideoInstaller","dataRootDir":"D:\\Files\\Github\\YoutubeVideoInstaller","staticDir":"D:\\Files\\Github\\YoutubeVideoInstaller\\static","tmpDir":"D:\\Files\\Github\\YoutubeVideoInstaller\\tmp","tmpDirExists":true,"diskCleanupThreshold":90,"taskTimeout":{"parse":60000,"download":3600000},"activeDownloads":0,"queuedTasks":0,"cookie":{"configured":true,"path":"D:\\Files\\Github\\YoutubeVideoInstaller\\cookies.txt","exists":true},"disk":{"checkedAt":null,"action":"idle","usedPercent":null,"threshold":90,"activeDownloads":0,"tmpDir":"D:\\Files\\Github\\YoutubeVideoInstaller\\tmp","message":""}},"proxy":{"configured":true,"value":"http://127.0.0.1:7890","fallbackDirect":true,"sitePolicy":{"y2b":{"proxy":"http://127.0.0.1:7890","fallbackDirect":true},"b2b":{"proxy":"","fallbackDirect":false}},"env":{"HTTP_PROXY":"","HTTPS_PROXY":""}},"toolStatus":{"ytDlp":{"ok":true,"message":"2026.03.17"},"ffmpeg":{"ok":true,"message":"ffmpeg version 8.1-essentials_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers"}}}}
```

## Parse sample: YouTube

Request:

```text
GET /y2b/parse?url=https://www.youtube.com/watch?v=iwtr3g9Tbrk
```

Observed behavior:

- `success: true`
- `website: y2b`
- `sourceType: youtube-watch`
- Returns title, thumbnail, thumbnail candidates, best audio/video, full audio list, full video list.

Observed response sample:

```json
{"success":true,"result":{"website":"y2b","v":"iwtr3g9Tbrk","p":null,"source":"https://www.youtube.com/watch?v=iwtr3g9Tbrk","sourceType":"youtube-watch","title":"AI vs Minesweeper","thumbnail":"https://i.ytimg.com/vi/iwtr3g9Tbrk/maxresdefault.jpg","thumbnailCandidates":["https://i.ytimg.com/vi/iwtr3g9Tbrk/maxresdefault.jpg","https://i.ytimg.com/vi/iwtr3g9Tbrk/hq720.jpg","https://i.ytimg.com/vi/iwtr3g9Tbrk/sddefault.jpg","https://i.ytimg.com/vi/iwtr3g9Tbrk/hqdefault.jpg","https://i.ytimg.com/vi/iwtr3g9Tbrk/mqdefault.jpg","https://i.ytimg.com/vi/iwtr3g9Tbrk/default.jpg"],"parts":[],"best":{"audio":{"id":"140","format":"m4a","rate":"130kbps","info":"English (US) original (default), medium","size":"0.24MB","rateValue":130.163,"height":0},"video":{"id":"299","format":"mp4","codec":"avc1.64002a","scale":"1080x1920","frame":"60fps","rate":"4253kbps","info":"1080p60","size":"7.77MB","rateValue":4253.241,"height":1920}},"available":{"audios":[{"id":"139","format":"m4a","rate":"50kbps","info":"English (US) original (default), low","size":"0.09MB"},{"id":"249","format":"webm","rate":"48kbps","info":"English (US) original (default), low","size":"0.09MB"},{"id":"140","format":"m4a","rate":"130kbps","info":"English (US) original (default), medium","size":"0.24MB"},{"id":"251","format":"webm","rate":"121kbps","info":"English (US) original (default), medium","size":"0.22MB"}],"videos":[{"id":"160","format":"mp4","codec":"avc1.4d400c","scale":"144x256","frame":"30fps","rate":"101kbps","info":"144p","size":"0.19MB"},{"id":"133","format":"mp4","codec":"avc1.4d4015","scale":"240x426","frame":"30fps","rate":"216kbps","info":"240p","size":"0.40MB"},{"id":"242","format":"webm","codec":"vp9","scale":"240x426","frame":"30fps","rate":"103kbps","info":"240p","size":"0.19MB"}]},"note":"可选择原始格式下载，或转码为H.264 MP4下载"}}
```

## Parse sample: Bilibili

Request:

```text
GET /y2b/parse?url=https://www.bilibili.com/video/BV1xx411c7mD
```

Observed behavior:

- `success: true`
- `website: b2b`
- `sourceType: bilibili-video`
- Returns title, thumbnail, thumbnail candidates, best audio/video, full audio list, full video list.

Observed response sample:

```json
{"success":true,"result":{"website":"b2b","v":"BV1xx411c7mD","p":null,"source":"https://www.bilibili.com/video/BV1xx411c7mD","sourceType":"bilibili-video","title":"字幕君交流场所","thumbnail":"https://i0.hdslb.com/bfs/archive/transparent.png","thumbnailCandidates":["https://i0.hdslb.com/bfs/archive/transparent.png","https://i0.hdslb.com/bfs/archive/BV1xx411c7mD.jpg","https://i1.hdslb.com/bfs/archive/BV1xx411c7mD.jpg","https://i2.hdslb.com/bfs/archive/BV1xx411c7mD.jpg"],"parts":[],"best":{"audio":{"id":"30232","format":"m4a","rate":"135kbps","info":"无描述","size":"33.01MB","rateValue":134.695,"height":0},"video":{"id":"100023","format":"mp4","codec":"av01.0.01M.08.0.110.01.01.01.0","scale":"512x384","frame":"15.009fps","rate":"207kbps","info":"无描述","size":"50.61MB","rateValue":206.531,"height":384}},"available":{"audios":[{"id":"30216","format":"m4a","rate":"69kbps","info":"无描述","size":"16.82MB"},{"id":"30232","format":"m4a","rate":"135kbps","info":"无描述","size":"33.01MB"}],"videos":[{"id":"30016","format":"mp4","codec":"avc1.64001E","scale":"480x360","frame":"14.925fps","rate":"156kbps","info":"无描述","size":"38.14MB"},{"id":"100109","format":"mp4","codec":"hev1.1.6.L120.90","scale":"480x360","frame":"15fps","rate":"64kbps","info":"无描述","size":"15.74MB"},{"id":"100022","format":"mp4","codec":"av01.0.01M.08.0.110.01.01.01.0","scale":"480x360","frame":"15.009fps","rate":"206kbps","info":"无描述","size":"50.59MB"}]},"note":"可选择原始格式下载，或转码为H.264 MP4下载"}}
```

## Download sample: raw download polling

Request pattern:

```text
GET /y2b/download?website=y2b&v=iwtr3g9Tbrk&title=AI%20vs%20Minesweeper&format=299x140&transcode=0
```

Observed first response:

```json
{"success":true,"result":{"v":"iwtr3g9Tbrk","format":"299x140","transcode":false,"phase":"downloading","downloading":true,"downloadSucceed":false,"dest":"正在下载原始文件","metadata":""}}
```

Observed completed response:

```json
{"success":true,"result":{"v":"iwtr3g9Tbrk","title":"AI vs Minesweeper","format":"299x140","transcode":false,"phase":"completed","downloading":false,"downloadSucceed":true,"folder":"file/AI vs Minesweeper","dest":"file/AI vs Minesweeper/AI vs Minesweeper.f140.m4a","video":null,"audio":null,"openFolder":{"attempted":true,"opened":true,"error":""},"metadata":"info/AI vs Minesweeper/AI vs Minesweeper.info.json","note":"已按原始格式下载（未转码）"}}
```

## Download sample: transcode polling

Request pattern:

```text
GET /y2b/download?website=y2b&v=iwtr3g9Tbrk&title=AI%20vs%20Minesweeper&format=299x140&transcode=1
```

Observed phase transition:

- `downloading`
- `transcoding`
- `completed`

Observed transcoding response:

```json
{"success":true,"result":{"v":"iwtr3g9Tbrk","title":"AI vs Minesweeper","format":"299x140","transcode":true,"phase":"transcoding","downloading":true,"downloadSucceed":false,"dest":"下载完成，正在转码为 H.264 MP4","metadata":""}}
```

Observed completed response:

```json
{"success":true,"result":{"v":"iwtr3g9Tbrk","title":"AI vs Minesweeper","format":"299x140","transcode":true,"phase":"completed","downloading":false,"downloadSucceed":true,"folder":"file/AI vs Minesweeper","dest":"file/AI vs Minesweeper/AI vs Minesweeper-h264.mp4","video":"file/AI vs Minesweeper/AI vs Minesweeper.mp4","audio":null,"openFolder":{"attempted":true,"opened":true,"error":""},"metadata":"info/AI vs Minesweeper/AI vs Minesweeper.info.json","note":"已转换为h264编码的mp4格式（文件后缀: -h264.mp4）"}}
```

## Thumbnail behavior

### Stream mode

Request:

```text
GET /y2b/thumbnail?website=y2b&v=iwtr3g9Tbrk&src=https://i.ytimg.com/vi/iwtr3g9Tbrk/maxresdefault.jpg
```

Observed behavior:

- HTTP status: `200`
- `Content-Type: image/jpeg`
- `Cache-Control: public, max-age=3600`
- Returned binary bytes: `88099`

### Save mode

Request:

```text
GET /y2b/thumbnail?website=y2b&v=iwtr3g9Tbrk&title=AI%20vs%20Minesweeper&src=https://i.ytimg.com/vi/iwtr3g9Tbrk/maxresdefault.jpg&save=1
```

Observed response:

```json
{"success":true,"result":{"saved":true,"path":"D:\\Files\\Github\\YoutubeVideoInstaller\\tmp\\AI vs Minesweeper\\cover.jpg","dest":"file/AI vs Minesweeper/cover.jpg"}}
```

## Open-folder sample

Request:

```text
GET /y2b/open-folder?folder=file%2FAI%20vs%20Minesweeper
```

Observed response:

```json
{"success":true,"result":{"folder":"file/AI vs Minesweeper","opened":true}}
```

## Error behavior summary

- Most business errors return HTTP `200` with `success: false`.
- Thumbnail API is the main exception:
  - invalid parameters: `400`
  - save failure: `500`
  - no valid image source and fetch failure: `502`
- `/y2b/*` can be globally blocked with `config.disable`.
