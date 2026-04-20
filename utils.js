function getRemoteIP(request) {
    return request.header('cf-connecting-ip') || request.ip || '未知IP';
}

function getWebsiteUrl(website, id, p) {
    return `https://youtu.be/${id}`;
}

module.exports = {
    getRemoteIP,
    getWebsiteUrl,
}
