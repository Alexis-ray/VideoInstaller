# Youtube-dl-REST

通过本项目，您可以搭建一个网页，快速下载各种Youtube、Bili视频。


## 安装

如果您使用docker，推荐使用以下命令运行本项目：

```
docker volume create vol
docker run -it -d --name youtube-dl-rest -p 80:80 -v vol:/Youtube-dl-REST imgxx/youtube-dl-rest
```

你可能需要修改 config.json 、替换自己的 cookies.txt 等文件，然后重启容器：

```
vi /var/lib/docker/volumes/vol/_data/config.json
vi /var/lib/docker/volumes/vol/_data/cookies.txt
docker restart youtube-dl-rest
```

如果您不使用docker，则按以下步骤进行安装：

### 1.安装Node.js

以Ubuntu为例，使用snapd安装：
```
sudo apt install -y snapd

sudo snap install core
sudo snap install node --classic --channel=14

node -v
```

### 2.安装[yt-dlp](https://github.com/yt-dlp/yt-dlp)和[FFmpeg](https://github.com/yt-dlp/yt-dlp)

确保`yt-dlp`命令和`ffmpeg`命令可用:
```
sudo yt-dlp -U
ffmpeg -version
```

### 3.克隆本项目

克隆之后使用`npm`安装依赖模块：
```
git clone https://github.com/develon2015/Youtube-dl-REST.git
cd Youtube-dl-REST
npm install
```

### 4.启动项目

您最好在screen或tmux中运行：
```
npm start
```


## Sponsors

[![image](https://github.com/user-attachments/assets/dae292e1-3a99-4f6b-b423-4b973ef0d49b)](https://yxvm.com/)

[NodeSupport](https://github.com/NodeSeekDev/NodeSupport) 赞助了本项目
