const forbiddenWords = [
    /f[u*]{1,2}ck(?:ing)?/gi,
    /sh[i!]{1}t/gi,
    /b[i1]{1}tch/gi,
    /asshole/gi,
    /bastard/gi,
    /damn/gi,
    /crap/gi,
    /dick/gi,
    /piss/gi,
    /wtf/gi,
    /stfu/gi,
    /idiot/gi,
    /stupid/gi,
    /moron/gi,
    /loser/gi,
    /dumb/gi,
    /kys/gi,
    /kill yourself/gi,
    /go die/gi,
    /porn/gi,
    /sex/gi,
    /nude/gi,
    /nudes/gi,
    /drugs/gi,
    /weed/gi,
    /cocaine/gi,
    /meth/gi,
    /a\$\$/gi,
    /f\s+u\s+c\s+k/gi
];

function sanitize(text) {
    if (!text || typeof text !== 'string') return text;
    let sanitized = text;
    forbiddenWords.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '***');
    });
    return sanitized;
}

export { sanitize };
