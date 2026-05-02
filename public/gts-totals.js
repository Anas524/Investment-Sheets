// gts-totals.js — cycle-aware + backwards compatible

(function () {
    let __materialsReqId = 0; // increasing id for materials totals requests
    let __materialsLocked = false;
    window.__materialsLockedToServer = false;

    // ----------------- State -----------------
    const EPS = 0.005;
    window.sheetTotals = window.sheetTotals || { material: 0, shipping: 0, investment: 0, ts: Date.now() };
    let lastPaint = { material: null, shipping: null, investment: null };

    // paint priority: server (2) > dom (1) > mem (0)
    const ORIGIN_PRIO = { server: 2, dom: 1, mem: 0, none: -1 };
    let lastPaintMeta = { origin: 'none', seq: 0 };

    const __paintPrio = { server: 3, dom: 2, mem: 1, none: 0 };
    let __lastPaintMeta = { origin: 'none', reqId: 0 };

    function __shouldPaint(origin, reqId, force) {
        if (force) return true;
        const prev = __lastPaintMeta;
        if (__paintPrio[origin] < __paintPrio[prev.origin]) return false;
        if (__paintPrio[origin] === __paintPrio[prev.origin] && reqId < prev.reqId) return false;
        return true;
    }

    // ----------------- Helpers -----------------
    function getActiveCycleId() {
        if (typeof window.activeCycleId !== 'undefined') return Number(window.activeCycleId) || 0;
        if (window.cycle && window.cycle.id) return Number(window.cycle.id) || 0;
        try { const v = localStorage.getItem('activeCycleId'); if (v) return Number(v) || 0; } catch { }
        return 0;
    }
    function totalsKeyFor(cycleId) { return `gts:totals:cycle:${cycleId || 'none'}`; }
    function sameTotals(a, b) {
        return Math.abs((Number(a.material) || 0) - (Number(b.material) || 0)) < EPS &&
            Math.abs((Number(a.shipping) || 0) - (Number(b.shipping) || 0)) < EPS &&
            Math.abs((Number(a.investment) || 0) - (Number(b.investment) || 0)) < EPS;
    }
    function formatCurrency(n) {
        const v = Number(n) || 0;
        return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ----------------- Storage -----------------
    function setGtsTotalsToStorage(st) {
        const cid = getActiveCycleId();
        const payload = {
            material: Number(st.material) || 0,
            shipping: Number(st.shipping) || 0,
            investment: Number(st.investment) || 0,
            ts: Number(st.ts) || Date.now(),
            cycle_id: cid
        };
        try { localStorage.setItem(totalsKeyFor(cid), JSON.stringify(payload)); } catch { }
    }
    function getGtsTotalsFromStorage() {
        const cid = getActiveCycleId();
        try {
            const raw = localStorage.getItem(totalsKeyFor(cid));
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    // ----------------- Painters -----------------
    function _paint(t) {
        // Paint ONLY the GTS Materials widgets; never add/accumulate
        // Normalize
        const mat = Number(t?.material) || 0;
        const ship = Number(t?.shipping) || 0;
        const inv = Number(t?.investment) || 0;

        // Paint ONLY the GTS Materials page widgets
        const fx = n => 'AED ' + formatCurrency(n);
        $('#gtsMaterialTotal').text(fx(mat));
        $('#gtsShippingTotal').text(fx(ship));
        $('#totalInvestmentAmount-material').text(fx(inv));

        const remaining = (mat + ship) - inv;
        $('#remainingAmount').text(fx(remaining));

        console.log('[GTS] materials totals payload:', t);
        console.table?.([t]);
        window.__lastMaterialsTotals = t;
    }

    // ----------------- Public API -----------------
    function applyTotals(t, opts = {}) {
        // default origin is DOM unless explicitly set
        const origin = opts.origin || 'dom';
        const reqId = typeof opts.reqId === 'number' ? opts.reqId : (__lastPaintMeta.reqId + 1);

        // If we already painted from the server, ignore later DOM/mem paints
        if (__materialsLocked && origin !== 'server' && !opts.allowAfterLock) return;

        if (!__shouldPaint(origin, reqId, opts.force)) return;

        const next = {
            material: Number(t.material) || 0,
            shipping: Number(t.shipping) || 0,
            investment: Number(t.investment) || 0,
            ts: Date.now(),
        };

        // If unchanged, still commit to memory/storage and broadcast once
        if (lastPaint.material !== null && sameTotals(lastPaint, next)) {
            __lastPaintMeta = { origin, reqId };

            // commit first so listeners see fresh snapshot
            window.sheetTotals = { ...next };
            setGtsTotalsToStorage(next);

            // broadcast even if values didn't change (Summary may be waiting)
            try { document.dispatchEvent(new CustomEvent('gts:totals-changed', { detail: next })); } catch { }

            return;
        }

        // paint the Materials page widgets
        _paint(next);

        // commit before broadcast (so listeners can also read window.sheetTotals)
        __lastPaintMeta = { origin, reqId };
        lastPaint = { ...next };
        window.sheetTotals = { ...next };
        setGtsTotalsToStorage(next);

        // broadcast to Summary / Investments
        try { document.dispatchEvent(new CustomEvent('gts:totals-changed', { detail: next })); } catch { }

        // Lock after the first authoritative server paint
        if (origin === 'server') {
            __materialsLocked = true;
            window.__materialsLockedToServer = true; // <- other files can respect this
        }
    }

    function postSnapshot(cycleId, totals) {
        return $.ajax({
            url: `/cycles/${cycleId}/materials/totals/snapshot`,
            method: 'POST',
            data: {
                material: totals.material,
                shipping: totals.shipping,
                investment: totals.investment,
                ts: totals.ts
            },
            headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
        }).catch(err => console.warn('Snapshot POST failed', err));
    }

    function updateTotals(partial, opts = {}) {
        const prev = window.sheetTotals || {};
        const merged = {
            material: ('material' in partial) ? Number(partial.material) || 0 : Number(prev.material) || 0,
            shipping: ('shipping' in partial) ? Number(partial.shipping) || 0 : Number(prev.shipping) || 0,
            investment: ('investment' in partial) ? Number(partial.investment) || 0 : Number(prev.investment) || 0,
            ts: Date.now()
        };
        window.sheetTotals = merged;
        setGtsTotalsToStorage(merged);
        // default origin to 'dom' so it can't trump server unless explicitly asked
        applyTotals(merged, { origin: opts.origin || 'dom', reqId: opts.reqId, force: opts.force, allowAfterLock: opts.allowAfterLock });
    }

    function updateInvestmentTotals(investmentTotal) {
        updateTotals({ investment: Number(investmentTotal) || 0 });
    }
    function applyInvestmentTotal(total) { updateInvestmentTotals(total); }

    // ----------------- Fetchers -----------------
    function fetchInvestmentTotal() {
        const url = (typeof window.investmentUrl === 'function')
            ? window.investmentUrl('gts-investments/total')
            : '/gts-investments/total';

        const finalUrl = window.withCycle ? window.withCycle(url) : url;
        return $.getJSON(finalUrl)
            .then(r => Number(r?.total) || Number(r?.investment) || 0)
            .catch(() => 0);
    }

    function fetchMaterialTotals() {
        const base = '/gts-materials/total';
        const finalUrl = window.withCycle ? window.withCycle(base) : base;

        return $.getJSON(finalUrl)
            .then(r => {
                // prefer real totals
                const material =
                    Number(r?.total_material) ||
                    Number(r?.total_material_buy) ||
                    Number(r?.material) ||
                    Number(r?.ui_total_material) ||
                    0;

                const shipping =
                    Number(r?.total_shipping_cost) ||
                    Number(r?.shipping_cost) ||
                    Number(r?.shipping) ||
                    0;

                return { material, shipping };
            })
            .catch(() => ({ material: 0, shipping: 0 }));
    }

    function fetchAndUpdateInvestmentTotal() {
        return fetchInvestmentTotal().then(total => {
            updateTotals({ investment: total }, { origin: 'server' });
            return total;
        });
    }


    // server fetches
    function fetchAndUpdateMaterialTotals() {
        const reqId = ++__materialsReqId;
        return fetchMaterialTotals().then(({ material, shipping }) => {
            updateTotals({ material, shipping }, { origin: 'server', reqId });
            return { material, shipping };
        });
    }


    // ----------------- Orchestrators / Shims -----------------
    function refreshAllTotals() {
        const reqId = ++__materialsReqId;
        return Promise.all([fetchInvestmentTotal(), fetchMaterialTotals()])
            .then(([inv, ms]) => applyTotals(
                { material: ms.material, shipping: ms.shipping, investment: Number(inv) || 0 },
                { origin: 'server', reqId, force: true }
            ));
    }

    function clearTotalsCache() {
        try { localStorage.removeItem(totalsKeyFor(getActiveCycleId())); } catch { }
    }

    // ----------------- Events -----------------
    function onCycleChanged() {
        clearTotalsCache();
        refreshAllTotals();
    }
    document.addEventListener('cycle:changed', onCycleChanged);
    // legacy alias for old code paths that still dispatch set:changed
    document.addEventListener('set:changed', onCycleChanged);

    document.addEventListener('cycle:closed', () => { clearTotalsCache(); applyTotals({ material: 0, shipping: 0, investment: 0 }, { force: true }); });
    document.addEventListener('set:closed', () => { clearTotalsCache(); applyTotals({ material: 0, shipping: 0, investment: 0 }, { force: true }); });

    // ----------------- Expose to window (back-compat) -----------------
    window.applyTotals = applyTotals;
    window.updateTotals = updateTotals;
    window.updateInvestmentTotals = updateInvestmentTotals;
    window.applyInvestmentTotal = applyInvestmentTotal;

    window.fetchInvestmentTotal = fetchInvestmentTotal;
    window.fetchMaterialTotals = fetchMaterialTotals;
    window.fetchAndUpdateInvestmentTotal = fetchAndUpdateInvestmentTotal;
    window.fetchAndUpdateMaterialTotals = fetchAndUpdateMaterialTotals;

    window.getGtsTotalsFromStorage = getGtsTotalsFromStorage;
    window.setGtsTotalsToStorage = setGtsTotalsToStorage;

    // optional shims some projects used:
    window.paintTotals = applyTotals;
    window.updateTotalsUI = applyTotals;
    window.refreshAllTotals = refreshAllTotals;
    window.clearTotalsCache = clearTotalsCache;
})();