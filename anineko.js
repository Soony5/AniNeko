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
        const query = keyword.replace(/\s+/g, '+');
        const html = await soraFetch(`https://anineko.to/browser?keyword=${query}`);
        if (!html) return JSON.stringify([{ title: 'Errore: Nessuna risposta dal server', href: '', image: '' }]);
              if (html.indexOf('Just a moment...') !== -1 || html.indexOf('cloudflare') !== -1) {
            return JSON.stringify([{ title: 'Errore: Cloudflare ha bloccato la richiesta', href: '', image: '' }]);
        }

        const results = [];
        const regex = /<article class="nv-anime-card[^>]*>([\s\S]*?)<\/article>/g;
        let match;
        const seen = new Set();
        while ((match = regex.exec(html)) !== null) {
            const block = match[1];
            const hrefMatch = block.match(/href="([^"]+)"/);
            const imgMatch = block.match(/src="([^"]+)"/);
            const altMatch = block.match(/alt="([^"]+)"/);
            if (hrefMatch && imgMatch && altMatch) {
                const href = 'https://anineko.to' + hrefMatch[1].trim();
                if (!seen.has(href)) {
                    seen.add(href);
                    results.push({ 
                        title: altMatch[1].replace(/&quot;/g, '"').trim(), 
                        href, 
                        image: imgMatch[1].trim() 
                    });
                }
            }
        }
        
        if (results.length === 0) {
            return JSON.stringify([{ title: 'Nessun risultato trovato o regex fallita', href: '', image: '' }]);
        }
        
        return JSON.stringify(results);
    } catch (e) {
        return JSON.stringify([{ title: 'Errore: ' + e.message, image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const html = await _fetchPage(url);
        let description = 'Nessuna descrizione trovata';

        const metaIdx = html.indexOf('<meta name="description"');
        if (metaIdx !== -1) {
            const slice = html.slice(metaIdx, metaIdx + 400);
            const m = slice.match(/content="([^"]+)"/);
            if (m) description = m[1].replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
        }

        return JSON.stringify([{ description, aliases: '', airdate: '' }]);
    } catch (e) {
        return JSON.stringify([{ description: 'Errore durante il caricamento della descrizione', aliases: '', airdate: '' }]);
    }
}

async function extractChapters(url) {
    try {
        const html = await _fetchPage(url);

        const regex = /href="([^"]+\/watch\/[^"]+\/ep-\d+)"/g;
        const chapters = [];
        const seen = new Set();
        let match;
        
        while ((match = regex.exec(html)) !== null) {
            let epHref = match[1].trim();
            if (epHref.startsWith('/')) {
                epHref = 'https://anineko.to' + epHref;
            }
            if (!seen.has(epHref)) {
                seen.add(epHref);
                const epMatch = epHref.match(/ep-(\d+)/);
                const numberStr = epMatch ? epMatch[1] : null;
                if (numberStr) {
                    chapters.push({ href: epHref, title: `Episodio ${numberStr}`, num: parseInt(numberStr) });
                }
            }
        }

        chapters.sort((a, b) => a.num - b.num);
        return JSON.stringify(chapters.map((ch, i) => ({ href: ch.href, title: ch.title, number: i + 1 })));
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
