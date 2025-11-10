// 基于jQuery的工具库
/**
 * 修改文档标题
 * @param {string} [msg] - 标题内容，不传则恢复默认标题
 */
function setTitle(msg) {
    const titleElement = $('title');
    if (msg === undefined) {
        titleElement.text(window.defaultTitle || '');
    } else {
        titleElement.text(msg);
    }
}

// 创建Develon命名空间
((window) => {
    // 避免重复初始化
    if (window.Develon) return;

    window.Develon = {
        /**
         * 获取当前时间格式化字符串（如：2019年9月25日 19:03:37）
         * @returns {string} 格式化的时间字符串
         */
        getNowTime() {
            const options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: false,
            };
            return new Intl.DateTimeFormat('zh-CN', options).format(new Date());
        },

        /**
         * UI工厂方法 - 负责页面结构绘制
         * @returns {object} UI操作对象
         */
        getUI() {
            const ui = {
                values: {
                    viewportHTML: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
                    mainHTML: '<div id="divMain"></div>',
                    footerHTML: `
                        <div id="divFooter" class="flex">
                            <svg height="20" viewBox="0 0 16 16" version="1.1" width="32" aria-hidden="true">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"></path>
                            </svg>
                            <a class="white" href="https://github.com/develon2015/Youtube-dl-REST">Github - develon2015/Youtube-dl-REST</a>
                            <span class="time"></span>
                        </div>
                    `,
                },

                /**
                 * 创建主容器结构
                 */
                createDivMain() {
                    const bodyHTML = document.body.innerHTML;
                    document.body.innerHTML = '';

                    // 构建主结构
                    $(this.values.mainHTML).appendTo(document.body);
                    $('#divMain').html(bodyHTML);
                    $(this.values.footerHTML).appendTo(document.body);

                    // 设置时间和高度
                    $('.time').text(this.getNowTime());
                    const footerHeight = $('#divFooter').outerHeight() || 0;
                    $('#divMain').css('min-height', `calc(100vh - ${footerHeight}px)`);
                },

                /**
                 * 设置视口元标签
                 */
                setViewport() {
                    if (!$('meta[name="viewport"]').length) {
                        $(this.values.viewportHTML).appendTo('head');
                    }
                },

                /**
                 * 设置默认标题
                 * @param {string} title - 默认标题
                 */
                setDefaultTitle(title) {
                    window.defaultTitle = title;
                    if (!$('title').length) {
                        $('<title>').text(title).appendTo('head');
                    }
                },

                // 复用getNowTime方法
                getNowTime: window.Develon.getNowTime
            };

            return ui;
        },

        /**
         * 字符串转JSON对象（支持方法实例化）
         */
        JSON: {
            /**
             * 解析字符串为JSON对象
             * @param {string} jsonStr - 待解析的字符串
             * @returns {object|null} 解析后的对象或null
             */
            parse(jsonStr) {
                try {
                    // 使用Function构造器解析（支持函数）
                    return new Function(`return ${jsonStr}`)();
                } catch (error) {
                    console.error('JSON解析失败:', error);
                    return null;
                }
            }
        },

        /**
         * 移除通知
         * @param {number} id - 通知ID
         */
        removeNotify(id) {
            setTitle(); // 恢复默认标题
            $(`#notify${id}`).remove();
        },

        notifyID: 1,

        /**
         * 显示通知
         * @param {string} msg - 通知内容
         * @param {function} [callback] - 点击确定后的回调
         * @returns {number} 通知ID
         */
        notify(msg, callback) {
            setTitle(msg);
            const id = this.notifyID++;
            const $notify = $(`
                <div id="notify${id}" class="develon-notify">
                    <div class="notify-container">
                        <div class="notify-content">${msg}</div>
                        <div class="notify-btn" id="notifyBtn${id}">确定</div>
                    </div>
                </div>
            `).appendTo('body');

            $(`#notifyBtn${id}`).on('click', () => {
                let exClose = true;
                if (typeof callback === 'function') {
                    exClose = callback() !== false; // 回调返回false则不关闭
                }
                if (exClose) {
                    $notify.remove();
                    setTitle();
                }
            });

            // 失焦当前元素避免Enter键影响
            $(':focus').blur();
            return id;
        },

        /**
         * 显示等待通知（带进度动画）
         * @param {string} msg - 通知内容
         * @param {function} [callback] - 点击取消后的回调
         * @returns {number} 通知ID
         */
        notifyWait(msg, callback) {
            setTitle(msg);
            const id = this.notifyID++;
            const $notify = $(`
                <div id="notify${id}" class="develon-notify">
                    <div class="notify-container">
                        <div class="notify-content" id="notifyMsg${id}">${msg}</div>
                        <div class="notify-btn" id="notifyBtn${id}">取消</div>
                    </div>
                </div>
            `).appendTo('body');

            $(`#notifyBtn${id}`).on('click', () => {
                let exClose = true;
                if (typeof callback === 'function') {
                    exClose = callback() !== false;
                }
                if (exClose) {
                    $notify.remove();
                    setTitle();
                }
            });

            // 进度动画
            const points = '<-<--<---<----<-----';
            let n = 0;
            const progressInterval = setInterval(() => {
                const $msg = $(`#notifyMsg${id}`);
                if (!$msg.length) {
                    clearInterval(progressInterval);
                    return;
                }
                $msg.html(`${msg}<br>${points.substr(0, n)}`);
                n = (n + 1) % (points.length + 1);
            }, 20);

            $(':focus').blur();
            return id;
        },

        /**
         * 显示确认对话框
         * @param {string} msg - 确认内容
         * @param {function} [callbackYes] - 确定回调
         * @param {function} [callbackNo] - 取消回调
         * @returns {number} 对话框ID
         */
        confirm(msg, callbackYes, callbackNo) {
            const id = this.notifyID++;
            const $confirm = $(`
                <div id="notify${id}" class="develon-notify">
                    <div class="notify-container">
                        <div class="notify-content">${msg}</div>
                        <div class="notify-btns">
                            <span id="yes${id}" class="notify-btn">确定</span>
                            <span id="no${id}" class="notify-btn">取消</span>
                        </div>
                    </div>
                </div>
            `).appendTo('body');

            $(`#yes${id}`).on('click', () => {
                let exClose = true;
                if (typeof callbackYes === 'function') {
                    exClose = callbackYes() !== false;
                }
                if (exClose) {
                    $confirm.remove();
                }
            });

            $(`#no${id}`).on('click', () => {
                let exClose = true;
                if (typeof callbackNo === 'function') {
                    exClose = callbackNo() !== false;
                }
                if (exClose) {
                    $confirm.remove();
                }
            });

            $(':focus').blur();
            return id;
        }
    };

    // 页面加载完成后初始化UI
    $(() => {
        const ui = Develon.getUI();
        ui.setDefaultTitle("Youtube在线解析");
        ui.setViewport();
        ui.createDivMain();
    });
})(window);

/**
 * 日志输出
 * @param {string} msg - 日志内容
 */
function log(msg) {
    const $log = $('#log');
    if ($log.length) {
        $log.append(`${msg}<br>`);
    }
    console.log(msg);
}

// 添加全局样式（避免HTML中重复定义）
$('head').append(`
    <style>
        .develon-notify {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.75);
            z-index: 999999999;
        }
        .notify-container {
            width: 270px;
            max-width: 90%;
            font-size: 16px;
            text-align: center;
            background-color: #fff;
            border-radius: 15px;
            position: absolute;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
        .notify-content {
            padding: 10px 15px;
            border-bottom: 1px solid #ddd;
        }
        .notify-btn {
            padding: 10px 0;
            color: #007aff;
            font-weight: 600;
            cursor: pointer;
            user-select: none;
        }
        .notify-btns {
            padding: 10px 0;
            display: flex;
            justify-content: center;
        }
        .notify-btns .notify-btn {
            padding: 10px 20px;
        }
    </style>
`);