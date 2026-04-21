function getRemoteIP(request) {
    return request.header('cf-connecting-ip') || request.ip || '未知IP';
}

function getWebsiteUrl(website, id, p, sourceUrl) {
    const source = String(sourceUrl || '').trim();
    if (website === 'y2b') {
        return `https://youtu.be/${id}`;
    }
    if (website === 'b2b') {
        if (source && /^https?:\/\/(?:b23\.tv\/|(?:www\.)?bilibili\.com\/)/i.test(source)) {
            return source;
        }
        const page = p && String(p).match(/^\d+$/) ? `?p=${p}` : '';
        return `https://www.bilibili.com/video/${id}${page}`;
    }
    return source || String(id || '');
}

module.exports = {
    getRemoteIP,
    getWebsiteUrl,
}
