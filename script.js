
        // ====== STATE ======
        let searchHistory = [];
        let audioEl = null;

        // ====== DOM ======
        const $ = id => document.getElementById(id);
        const searchInput = $('searchInput');
        const searchBtn = $('searchBtn');
        const resultsDiv = $('results');
        const loaderDiv = $('loader');
        const suggestionsDiv = $('suggestions');
        const historySection = $('historySection');
        const historyChips = $('historyChips');
        const scrollTopBtn = $('scrollTop');

        // ====== EVENTS ======
        searchBtn.addEventListener('click', () => searchWord(searchInput.value));
        searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchWord(searchInput.value); });

        let debounce;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounce);
            const v = searchInput.value.trim();
            if (v.length < 2) { suggestionsDiv.classList.remove('active'); return; }
            debounce = setTimeout(() => fetchSuggestions(v), 280);
        });

        document.addEventListener('click', e => {
            if (!suggestionsDiv.contains(e.target) && e.target !== searchInput)
                suggestionsDiv.classList.remove('active');
        });

        window.addEventListener('scroll', () => {
            scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
        });

        // ====== SUGGESTIONS (Datamuse API) ======
        async function fetchSuggestions(q) {
            try {
                const r = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=6`);
                const d = await r.json();
                if (d.length) {
                    suggestionsDiv.innerHTML = d.map(i =>
                        `<div class="suggestion-item" onclick="searchWord('${i.word.replace(/'/g, "\\'")}')">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                            ${i.word}
                        </div>`
                    ).join('');
                    suggestionsDiv.classList.add('active');
                } else suggestionsDiv.classList.remove('active');
            } catch { suggestionsDiv.classList.remove('active'); }
        }

        // ====== TRANSLATION HELPER ======
        async function translateText(text, targetLang) {
            // Use Google Translate free endpoint
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
                const res = await fetch(url);
                const data = await res.json();
                // data[0] contains array of translation segments
                if (data && data[0]) {
                    return data[0].map(seg => seg[0]).join('');
                }
                return 'Translation unavailable';
            } catch {
                return 'Translation unavailable';
            }
        }

        // ====== SPEECH SYNTHESIS ======
        // Cached voices list, populated after voiceschanged fires
        let _voices = [];
        function _loadVoices() { _voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
        if (window.speechSynthesis) {
            _loadVoices();
            window.speechSynthesis.onvoiceschanged = _loadVoices;
        }

        function speakText(text, lang) {
            if (!text) return;
            window.speechSynthesis && window.speechSynthesis.cancel();
            if (audioEl) { audioEl.pause(); audioEl = null; }

            const ttsLang = lang.split('-')[0]; // 'mr-IN' †’ 'mr'

            // Try Web Speech API first (works natively on iOS Safari for supported langs)
            if (window.speechSynthesis) {
                const utter = new SpeechSynthesisUtterance(text);
                utter.lang = lang;
                utter.rate = 0.9;

                // Best-match voice: exact lang †’ prefix match †’ any Devanagari (for Marathi fallback)
                const voices = _voices.length ? _voices : window.speechSynthesis.getVoices();
                const exactMatch = voices.find(v => v.lang === lang);
                const prefixMatch = voices.find(v => v.lang.startsWith(ttsLang));
                // On iOS, 'hi-IN' voice can pronounce Marathi Devanagari passably
                const devaFallback = ttsLang === 'mr' ? voices.find(v => v.lang.startsWith('hi')) : null;
                const chosen = exactMatch || prefixMatch || devaFallback;
                if (chosen) utter.voice = chosen;

                // onend/onerror: if speech synthesis gave nothing (no voice), try Google TTS
                let spoke = false;
                utter.onstart = () => { spoke = true; };
                utter.onerror = (e) => {
                    // 'not-allowed' on iOS means we need a user-gesture audio element
                    if (!spoke) tryGoogleTTS(text, ttsLang);
                };

                window.speechSynthesis.speak(utter);

                // iOS sometimes silently does nothing when lang has no voice €” detect via timeout
                setTimeout(() => {
                    if (!spoke && !window.speechSynthesis.speaking) tryGoogleTTS(text, ttsLang);
                }, 600);
                return;
            }
            tryGoogleTTS(text, ttsLang);
        }

        function tryGoogleTTS(text, ttsLang) {
            const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${ttsLang}&client=tw-ob`;
            audioEl = new Audio(url);
            audioEl.play().catch(() => {
                // Last resort: re-try speechSynthesis with no voice preference
                if (window.speechSynthesis) {
                    const u = new SpeechSynthesisUtterance(text);
                    u.lang = ttsLang;
                    window.speechSynthesis.speak(u);
                }
            });
        }

        // ====== MAIN SEARCH ======
        async function searchWord(word) {
            word = word.trim().toLowerCase();
            if (!word) return;
            searchInput.value = word;
            suggestionsDiv.classList.remove('active');
            resultsDiv.innerHTML = '';
            loaderDiv.classList.add('active');

            if (!searchHistory.includes(word)) {
                searchHistory.unshift(word);
                if (searchHistory.length > 20) searchHistory.pop();
                renderHistory();
            }

            try {
                // Fetch dictionary + translations in parallel
                const [dictRes, hindi, marathi] = await Promise.all([
                    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`),
                    translateText(word, 'hi'),
                    translateText(word, 'mr')
                ]);

                const dictData = dictRes.ok ? await dictRes.json() : null;

                loaderDiv.classList.remove('active');

                if (!dictData) { showError(word); return; }

                const entry = dictData[0];

                // Collect example sentences for translation
                const examples = [];
                entry.meanings.forEach(m => m.definitions.forEach(d => { if (d.example) examples.push(d.example); }));

                // Translate first 3 example sentences in parallel
                let translatedExamples = {};
                const exToTranslate = examples.slice(0, 3);
                if (exToTranslate.length) {
                    const exPromises = exToTranslate.flatMap(ex => [
                        translateText(ex, 'hi'),
                        translateText(ex, 'mr')
                    ]);
                    const exResults = await Promise.all(exPromises);
                    exToTranslate.forEach((ex, i) => {
                        translatedExamples[ex] = {
                            hindi: exResults[i * 2] || '',
                            marathi: exResults[i * 2 + 1] || ''
                        };
                    });
                }

                renderResult(entry, hindi, marathi, translatedExamples);

            } catch {
                loaderDiv.classList.remove('active');
                showError(word);
            }
        }

        // ====== RENDER RESULT ======
        function renderResult(entry, hindi, marathi, translatedExamples) {
            const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
            const audioUrl = entry.phonetics?.find(p => p.audio && p.audio.length > 0)?.audio || '';

            let html = `<article class="word-card">`;

            // Header
            html += `<div class="word-header">
                <div class="word-title-group">
                    <h3>${entry.word}</h3>
                    ${phonetic ? `<div class="phonetic">${phonetic}</div>` : ''}
                </div>
                <div class="word-actions">
                    ${audioUrl ? `<button class="action-btn" onclick="playAudio('${audioUrl}')">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 002.5-3.5zM14 3.23v2.06a6.51 6.51 0 010 13.42v2.06A8.5 8.5 0 0014 3.23z"/></svg>
                        English
                    </button>` : `<button class="action-btn" onclick="speakText('${escAttr(entry.word)}','en-US')">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 002.5-3.5zM14 3.23v2.06a6.51 6.51 0 010 13.42v2.06A8.5 8.5 0 0014 3.23z"/></svg>
                        English
                    </button>`}
                    <button class="action-btn" onclick="copyText('${entry.word}')">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        Copy
                    </button>
                </div>
            </div>`;

            // Translations
            html += `<div class="translations-grid">
                <div class="translation-card hindi">
                    <div class="lang-label">Hindi</div>
                    <div class="translated-word">${escHtml(hindi)}</div>
                    <div style="display:flex;gap:10px;margin-top:10px;align-items:center;flex-wrap:wrap;">
                        <div class="copy-trans" onclick="speakText('${escAttr(hindi)}','hi-IN')"> Listen in Hindi</div>
                        <div class="copy-trans" onclick="copyText('${escAttr(hindi)}')">Copy</div>
                    </div>
                </div>
                <div class="translation-card marathi">
                    <div class="lang-label">Marathi</div>
                    <div class="translated-word">${escHtml(marathi)}</div>
                    <div style="display:flex;gap:10px;margin-top:10px;align-items:center;flex-wrap:wrap;">
                        <div class="copy-trans" onclick="speakText('${escAttr(marathi)}','mr-IN')">Listen in Marathi</div>
                        <div class="copy-trans" onclick="copyText('${escAttr(marathi)}')">Copy</div>
                    </div>
                </div>
            </div>`;

            // Meanings
            let allSyn = [], allAnt = [];

            entry.meanings.forEach(meaning => {
                html += `<div class="meanings-section">
                    <div class="section-label"><span class="pos-tag">${meaning.partOfSpeech}</span> Definitions</div>`;

                meaning.definitions.forEach((def, i) => {
                    html += `<div class="meaning-item">
                        <span class="meaning-number">${i + 1}</span>
                        <span class="definition-text">${escHtml(def.definition)}</span>`;

                    if (def.example) {
                        html += `<div class="example-sentence">${escHtml(def.example)}</div>`;

                        // Show translated sentences
                        const te = translatedExamples[def.example];
                        if (te && (te.hindi || te.marathi)) {
                            html += `<div class="translated-examples">`;
                            if (te.hindi) html += `<div class="te-label" style="color:var(--amber);">Hindi</div><div class="te-hindi">${escHtml(te.hindi)}</div>`;
                            if (te.marathi) html += `<div class="te-label" style="color:var(--sage);margin-top:8px;">Marathi</div><div class="te-marathi">${escHtml(te.marathi)}</div>`;
                            html += `</div>`;
                        }
                    }
                    html += `</div>`;
                });

                html += `</div>`;
                if (meaning.synonyms?.length) allSyn.push(...meaning.synonyms);
                if (meaning.antonyms?.length) allAnt.push(...meaning.antonyms);
            });

            // Synonyms & Antonyms
            allSyn = [...new Set(allSyn)].slice(0, 12);
            allAnt = [...new Set(allAnt)].slice(0, 12);

            if (allSyn.length || allAnt.length) {
                html += `<div class="word-pills-section">`;
                if (allSyn.length) {
                    html += `<div class="pills-group"><h4>Synonyms</h4><div class="pills-wrap">`;
                    allSyn.forEach(s => html += `<span class="pill synonym" onclick="searchWord('${escAttr(s)}')">${escHtml(s)}</span>`);
                    html += `</div></div>`;
                }
                if (allAnt.length) {
                    html += `<div class="pills-group"><h4>Antonyms</h4><div class="pills-wrap">`;
                    allAnt.forEach(a => html += `<span class="pill antonym" onclick="searchWord('${escAttr(a)}')">${escHtml(a)}</span>`);
                    html += `</div></div>`;
                }
                html += `</div>`;
            }

            // Source
            if (entry.sourceUrls?.length) {
                html += `<div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--text-secondary);">
                    Source: <a href="${entry.sourceUrls[0]}" target="_blank" rel="noopener" style="color:var(--amber);">${entry.sourceUrls[0]}</a>
                </div>`;
            }

            html += `</article>`;
            resultsDiv.innerHTML = html;

            // Smooth scroll to result
            setTimeout(() => resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }

        function showError(word) {
            resultsDiv.innerHTML = `
                <div class="error-card">
                    <div class="error-icon">ðŸ“–</div>
                    <h3>Word not found</h3>
                    <p>"<strong>${escHtml(word)}</strong>" could not be found. Please check the spelling and try again.</p>
                </div>`;
        }

        // ====== UTILITIES ======
        function playAudio(url) {
            if (audioEl) audioEl.pause();
            audioEl = new Audio(url);
            audioEl.play();
        }

        function copyText(text) {
            navigator.clipboard.writeText(text).then(() => {
                const toast = document.createElement('div');
                toast.textContent = 'Copied!';
                toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--parchment);padding:8px 20px;border-radius:8px;font-size:14px;z-index:9999;animation:slideUp 0.3s ease;';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 1500);
            });
        }

        function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
        function escAttr(s) { return s.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

        function renderHistory() {
            if (!searchHistory.length) { historySection.style.display = 'none'; return; }
            historySection.style.display = 'block';
            historyChips.innerHTML = searchHistory.map(w =>
                `<button class="history-chip" onclick="searchWord('${escAttr(w)}')">${escHtml(w)}</button>`
            ).join('');
        }

        function toggleTheme() {
            document.body.classList.toggle('dark-theme');
            document.querySelector('.theme-toggle').textContent =
                document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
        }
    
