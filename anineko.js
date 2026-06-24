const _pageCache = new Map();

async function _fetchPage(url) {
    if (_pageCache.has(url)) return _pageCache.get(url);
    const text = await soraFetch(url);
    if (!text) return '';
    _pageCache.set(url, text);
    setTimeout(() => _pageCache.delete(url), 60000);
    return text;
}

async function searchResults(keyword) {
    try {
        const html = await soraFetch(`https://anineko.to/browser?keyword=${encodeURIComponent(keyword)}`);
        const results = [];
        const regex = /<a class="nv-anime-thumb[^"]*" href="([^"]+)">\s*<img src="([^"]+)" alt="([^"]+)"/g;
        let match;
        const seen = new Set();
        while ((match = regex.exec(html)) !== null) {
            const href = 'https://anineko.to' + match[1].trim();
            if (!seen.has(href)) {
                seen.add(href);
                results.push({ title: match[3].replace(/&quot;/g, '"').trim(), href, image: match[2].trim() });
            }
        }
        return JSON.stringify(results);
    } catch (e) {
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const html = await _fetchPage(url);
        let description = 'No description found';

        const metaIdx = html.indexOf('<meta name="description"');
        if (metaIdx !== -1) {
            const slice = html.slice(metaIdx, metaIdx + 400);
            const m = slice.match(/content="([^"]+)"/);
            if (m) description = m[1].replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
        }

        return JSON.stringify([{ description, aliases: '', airdate: '' }]);
    } catch (e) {
        return JSON.stringify([{ description: 'Error loading description', aliases: '', airdate: '' }]);
    }
}

async function extractChapters(url) {
    try {
        const html = await _fetchPage(url);

        const regex = /<a class="nv-info-episode-main" href="([^"]+)">/g;
        const chapters = [];
        const seen = new Set();
        let match;
        let number = 1;
        while ((match = regex.exec(html)) !== null) {
            const href = 'https://anineko.to' + match[1].trim();
            if (!seen.has(href)) {
                seen.add(href);
                const epMatch = href.match(/ep-(\d+)/);
                const title = epMatch ? `Episode ${epMatch[1]}` : `Episode ${number}`;
                chapters.push({ href, title: title });
                number++;
            }
        }

        return JSON.stringify(chapters.map((ch, i) => ({ ...ch, number: i + 1 })));
    } catch (e) {
        return JSON.stringify([]);
    }
}

async function extractText(url) {
    try {
        const html = await soraFetch(url);
        const match = html.match(/data-video="([^"]+)"/);
        if (match) {
            return `<iframe src="${match[1]}" style="width:100%;height:100%;border:none;" allowfullscreen></iframe>`;
        }
        return 'Video non trovato.';
    } catch (e) {
        return 'Errore estrazione contenuto.';
    }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e) {
        try {
            const res = await fetch(url, options);
            return await res.text();
        } catch (_) {
            return null;
        }
    }
}
