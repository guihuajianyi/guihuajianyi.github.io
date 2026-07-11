// ============================================
// 语录 - 主交互逻辑
// ============================================

(function() {
    'use strict';

    // ---- State ----
    const state = {
        currentTag: 'all',
        searchQuery: '',
        currentPage: 1,
        pageSize: 24,
        likedIds: new Set(JSON.parse(localStorage.getItem('likedQuotes') || '[]'))
    };

    // ---- DOM References ----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        quotesGrid: $('#quotesGrid'),
        filterTabs: $('#filterTabs'),
        searchInput: $('#searchInput'),
        searchClear: $('#searchClear'),
        noResults: $('#noResults'),
        pagination: $('#pagination'),
        totalCount: $('#totalCount'),
        categoryCount: $('#categoryCount'),
        modalOverlay: $('#modalOverlay'),
        modalContent: $('#modalContent'),
        modalClose: $('#modalClose'),
        toast: $('#toast'),
        backToTop: $('#backToTop'),
        header: $('.header'),
        menuToggle: $('#menuToggle'),
        mobileMenu: $('#mobileMenu')
    };

    // ---- Filtered Data ----
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function getAllTags() {
        const seen = new Set();
        const tags = [];

        quotesData.forEach((quote) => {
            quote.tags.forEach((tag) => {
                if (!seen.has(tag)) {
                    seen.add(tag);
                    tags.push(tag);
                }
            });
        });

        return tags;
    }

    function getFilteredQuotes() {
        let filtered = [...quotesData];

        if (state.currentTag !== 'all') {
            filtered = filtered.filter(q => q.tags.includes(state.currentTag));
        }

        if (state.searchQuery.trim()) {
            const q = state.searchQuery.trim().toLowerCase();
            filtered = filtered.filter(item =>
                item.text.toLowerCase().includes(q) ||
                item.source.toLowerCase().includes(q) ||
                item.tags.some(t => t.toLowerCase().includes(q))
            );
        }

        return filtered;
    }

    // ---- Render ----
    function renderFilterTabs() {
        const tags = getAllTags();
        if (dom.categoryCount) {
            dom.categoryCount.textContent = tags.length;
        }

        if (state.currentTag !== 'all' && !tags.includes(state.currentTag)) {
            state.currentTag = 'all';
        }

        dom.filterTabs.innerHTML = [
            `<button class="filter-tab ${state.currentTag === 'all' ? 'active' : ''}" data-tag="all">全部</button>`,
            ...tags.map((tag) => `
                <button class="filter-tab ${state.currentTag === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
            `)
        ].join('');
    }

    function renderQuotes() {
        const filtered = getFilteredQuotes();
        const total = filtered.length;
        const totalPages = Math.ceil(total / state.pageSize);
        if (total > 0 && state.currentPage > totalPages) {
            state.currentPage = totalPages;
        }
        const start = (state.currentPage - 1) * state.pageSize;
        const pageItems = filtered.slice(start, start + state.pageSize);

        // Update total count
        dom.totalCount.textContent = total;

        // Show/hide no results
        if (total === 0) {
            dom.quotesGrid.innerHTML = '';
            dom.noResults.style.display = 'block';
            dom.pagination.innerHTML = '';
        } else {
            dom.noResults.style.display = 'none';
        }

        // Render cards
        dom.quotesGrid.innerHTML = pageItems.map((q, i) => {
            const isLiked = state.likedIds.has(q.id);
            const tagsHtml = q.tags.map(t => `
                <button class="quote-tag" data-action="filter-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>
            `).join('');
            return `
                <div class="quote-card" data-id="${q.id}" style="animation-delay: ${i * 0.05}s">
                    <div class="quote-tags">${tagsHtml}</div>
                    <div class="quote-text">${escapeHtml(q.text)}</div>
                    <div class="quote-meta">
                        <span class="quote-source">—— ${escapeHtml(q.source)}${q.date ? ` · ${escapeHtml(q.date)}` : ''}</span>
                        <div class="quote-actions">
                            <button class="quote-action-btn like-btn ${isLiked ? 'liked' : ''}" data-id="${q.id}" data-action="like" aria-label="${isLiked ? '取消收藏' : '收藏'}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                            </button>
                            <button class="quote-action-btn copy-btn" data-id="${q.id}" data-action="copy" aria-label="复制">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Render pagination
        renderPagination(totalPages);

        // Attach card click events
        dom.quotesGrid.querySelectorAll('.quote-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open modal if clicking action buttons
                if (e.target.closest('[data-action]')) return;
                const id = parseInt(card.dataset.id);
                const quote = quotesData.find(q => q.id === id);
                if (quote) openModal(quote);
            });
        });

        // Attach action button events
        dom.quotesGrid.querySelectorAll('[data-action="like"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLike(parseInt(btn.dataset.id));
            });
        });

        dom.quotesGrid.querySelectorAll('[data-action="copy"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const quote = quotesData.find(q => q.id === id);
                if (quote) copyQuote(quote);
            });
        });

        dom.quotesGrid.querySelectorAll('[data-action="filter-tag"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                filterByTag(btn.dataset.tag);
            });
        });
    }

    function renderPagination(totalPages) {
        if (totalPages <= 1) {
            dom.pagination.innerHTML = '';
            return;
        }

        const current = state.currentPage;
        let html = '';

        // Prev
        html += `<button class="page-btn" ${current === 1 ? 'disabled' : ''} data-page="${current - 1}" aria-label="上一页">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>`;

        // Pages
        const maxVisible = 5;
        let startPage = Math.max(1, current - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (startPage > 2) html += `<span class="page-ellipsis">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Next
        html += `<button class="page-btn" ${current === totalPages ? 'disabled' : ''} data-page="${current + 1}" aria-label="下一页">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>`;

        dom.pagination.innerHTML = html;

        // Attach pagination events
        dom.pagination.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                state.currentPage = parseInt(btn.dataset.page);
                dom.quotesGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
                renderQuotes();
            });
        });
    }

    // ---- Modal ----
    function openModal(quote) {
        const isLiked = state.likedIds.has(quote.id);
        const tagsHtml = quote.tags.map(t => `<span class="modal-tag">${escapeHtml(t)}</span>`).join('');

        dom.modalContent.innerHTML = `
            <div class="modal-quote-text">${escapeHtml(quote.text)}</div>
            <div class="modal-source">—— <strong>${escapeHtml(quote.source)}</strong>${quote.date ? ` · ${escapeHtml(quote.date)}` : ''}</div>
            <div class="modal-tags">${tagsHtml}</div>
            <div class="modal-actions">
                <button class="modal-action-btn" id="modalLikeBtn" data-id="${quote.id}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    ${isLiked ? '已收藏' : '收藏'}
                </button>
                <button class="modal-action-btn primary" id="modalCopyBtn" data-id="${quote.id}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    复制语录
                </button>
            </div>
        `;

        dom.modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Modal action handlers
        setTimeout(() => {
            const likeBtn = $('#modalLikeBtn');
            const copyBtn = $('#modalCopyBtn');
            if (likeBtn) {
                likeBtn.addEventListener('click', () => toggleLike(quote.id));
            }
            if (copyBtn) {
                copyBtn.addEventListener('click', () => copyQuote(quote));
            }
        }, 100);
    }

    function closeModal() {
        dom.modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ---- Actions ----
    function toggleLike(id) {
        if (state.likedIds.has(id)) {
            state.likedIds.delete(id);
        } else {
            state.likedIds.add(id);
        }
        localStorage.setItem('likedQuotes', JSON.stringify([...state.likedIds]));
        renderQuotes();

        const isLiked = state.likedIds.has(id);
        showToast(isLiked ? '已收藏 ❤️' : '已取消收藏');

        // Update modal if open
        if (dom.modalOverlay.classList.contains('active')) {
            const modalLikeBtn = $('#modalLikeBtn');
            if (modalLikeBtn && parseInt(modalLikeBtn.dataset.id) === id) {
                const svg = modalLikeBtn.querySelector('svg');
                if (svg) svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
                modalLikeBtn.innerHTML = modalLikeBtn.innerHTML.replace(isLiked ? '收藏' : '已收藏', isLiked ? '已收藏' : '收藏');
            }
        }
    }

    async function copyQuote(quote) {
        const text = `"${quote.text}"\n—— ${quote.source}`;
        try {
            await navigator.clipboard.writeText(text);
            showToast('已复制到剪贴板 📋');
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('已复制到剪贴板 📋');
        }
    }

    // ---- Toast ----
    let toastTimer;
    function showToast(message) {
        clearTimeout(toastTimer);
        dom.toast.textContent = message;
        dom.toast.classList.add('show');
        toastTimer = setTimeout(() => {
            dom.toast.classList.remove('show');
        }, 2000);
    }

    // ---- Event Handlers ----
    function filterByTag(tag) {
        dom.filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        const tab = [...dom.filterTabs.querySelectorAll('.filter-tab')].find(t => t.dataset.tag === tag);
        if (tab) {
            tab.classList.add('active');
        }

        state.currentTag = tag;
        state.currentPage = 1;
        state.searchQuery = '';
        dom.searchInput.value = '';
        dom.searchClear.style.display = 'none';
        renderQuotes();

        // Scroll to quotes on mobile
        if (window.innerWidth < 768) {
            $('#quotes').scrollIntoView({ behavior: 'smooth' });
        }
    }

    function onFilterClick(e) {
        const tab = e.target.closest('.filter-tab');
        if (!tab) return;

        filterByTag(tab.dataset.tag);
    }

    function onSearchInput() {
        state.searchQuery = dom.searchInput.value;
        state.currentPage = 1;
        dom.searchClear.style.display = state.searchQuery ? 'flex' : 'none';
        renderQuotes();
    }

    function onSearchClear() {
        dom.searchInput.value = '';
        state.searchQuery = '';
        state.currentPage = 1;
        dom.searchClear.style.display = 'none';
        renderQuotes();
        dom.searchInput.focus();
    }

    function onScroll() {
        // Header shadow
        if (window.scrollY > 10) {
            dom.header.classList.add('scrolled');
        } else {
            dom.header.classList.remove('scrolled');
        }

        // Back to top
        if (window.scrollY > 600) {
            dom.backToTop.classList.add('visible');
        } else {
            dom.backToTop.classList.remove('visible');
        }
    }

    function onBackToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function toggleMobileMenu() {
        dom.menuToggle.classList.toggle('active');
        dom.mobileMenu.classList.toggle('active');
        document.body.style.overflow = dom.mobileMenu.classList.contains('active') ? 'hidden' : '';
    }

    function closeMobileMenu() {
        dom.menuToggle.classList.remove('active');
        dom.mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ---- Keyboard ----
    function onKeyDown(e) {
        if (e.key === 'Escape') {
            if (dom.modalOverlay.classList.contains('active')) {
                closeModal();
            }
            if (dom.mobileMenu.classList.contains('active')) {
                closeMobileMenu();
            }
        }
    }

    // ---- Data Loading ----
    /**
     * 解析文本格式的语录文件
     * 格式: 
     *   2026.6.6 14:37
     *   "语录内容..."
     *   标签：自相矛盾、课堂
     * 
     * 标签行可省略，多个标签可用顿号、逗号、空格、斜杠或竖线分隔。
     * 每个语录块之间用空行分隔
     */
    function parseTagLine(lines) {
        const tagLine = lines.slice(2).find(line => /^#?\s*(标签|tag|tags)\s*[:：]/i.test(line));
        if (!tagLine) return ['语录'];

        const tags = tagLine
            .replace(/^#?\s*(标签|tag|tags)\s*[:：]/i, '')
            .split(/[、,，/|;；\s]+/)
            .map(tag => tag.trim())
            .filter(Boolean);

        return tags.length ? [...new Set(tags)] : ['语录'];
    }

    function parseQuotesText(text) {
        const quotes = [];
        // 按空行分割各语录块
        const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
        
        blocks.forEach((block, index) => {
            const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length < 2) return;
            
            // 第一行: 日期时间 (如 "2026.6.6 14:37")
            const dateLine = lines[0];
            
            // 第二行: 语录内容（带引号）
            let quoteText = lines[1];
            // 去除首尾各种引号（中英文、全角半角）
            quoteText = quoteText.replace(/^[\u201c\u201d\u2018\u2019\u0022\u300c\u300d\u300e\u300f\uff02\u201c\u201d\u2018\u2019\u00ab\u00bb]+/, '')
                                 .replace(/[\u201c\u201d\u2018\u2019\u0022\u300c\u300d\u300e\u300f\uff02\u201c\u201d\u2018\u2019\u00ab\u00bb]+$/, '');
            
            quotes.push({
                id: index + 1,
                text: quoteText,
                date: dateLine,
                source: "《sita语录》",
                tags: parseTagLine(lines),
                liked: false
            });
        });
        
        return quotes;
    }

    async function loadQuotes() {
        try {
            const response = await fetch('quotes.txt?' + Date.now());
            if (response.ok) {
                const text = await response.text();
                const parsed = parseQuotesText(text);
                if (parsed.length > 0) {
                    console.log('✅ 从 quotes.txt 加载了 ' + parsed.length + ' 条语录');
                    return parsed;
                }
            }
        } catch (e) {
            console.log('⚠️ quotes.txt 加载失败，使用内置数据');
        }
        
        if (typeof quotesData !== 'undefined' && quotesData.length > 0) {
            console.log('📦 使用内置 data.js 数据 (' + quotesData.length + ' 条)');
            return quotesData;
        }
        
        return [];
    }

    // ---- Init ----
    async function init() {
        // 从文本文件加载语录（失败则回退到 data.js）
        quotesData = await loadQuotes();
        renderFilterTabs();

        // Render initial quotes
        renderQuotes();

        // Event listeners
        dom.filterTabs.addEventListener('click', onFilterClick);
        dom.searchInput.addEventListener('input', onSearchInput);
        dom.searchClear.addEventListener('click', onSearchClear);
        dom.modalClose.addEventListener('click', closeModal);
        dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.modalOverlay) closeModal();
        });
        dom.backToTop.addEventListener('click', onBackToTop);
        dom.menuToggle.addEventListener('click', toggleMobileMenu);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('keydown', onKeyDown);

        // Mobile menu links
        dom.mobileMenu.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });

        // Initial scroll check
        onScroll();
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
