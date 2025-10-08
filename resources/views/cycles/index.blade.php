<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <title>Dashboard (Sets)</title>
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
  {{-- jQuery for this page --}}
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
</head>

<body class="bg-gray-50 text-gray-800">

  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Dashboard</h1>

      <div class="flex items-center gap-4">
        <button id="openCreateSetBtn"
          class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          + Create & Open
        </button>
      </div>
    </div>

    {{-- Create & Open Modal --}}
    <div id="createSetModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
      <div class="bg-white rounded-2xl w-full max-w-lg shadow-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Create & Open Set</h2>
          <button id="closeCreateSetModal" class="text-gray-500 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <form id="createSetForm" class="space-y-4">
          @csrf
          <div>
            <label class="block text-sm font-medium mb-1">Set name</label>
            <input name="name" required class="w-full px-3 py-2 rounded border" placeholder="e.g., March 2025" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">From</label>
              <input type="date" name="date_from" class="w-full px-3 py-2 rounded border" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">To (optional)</label>
              <input type="date" name="date_to" class="w-full px-3 py-2 rounded border" />
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <button type="button" id="cancelCreateSetBtn" class="px-4 py-2 rounded border">Cancel</button>
            <button type="submit" class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
              Create & Open
            </button>
          </div>
        </form>
      </div>
    </div>

    {{-- Sets grid --}}
    <div id="cycleGrid" class="grid grid-cols-1 md:grid-cols-2 gap-5"></div>

    <div id="cyclesRoot"
      data-open-url-tmpl="{{ route('cycles.investments.page', ['cycle' => 'ID_PLACEHOLDER']) }}">
    </div>
    <script>
      window.OPEN_INVEST_URL_TMPL =
        document.getElementById('cyclesRoot')?.dataset.openUrlTmpl || '/c/ID_PLACEHOLDER/investments';
    </script>

    {{-- Put this right above the grid (or anywhere before the script that reads it) --}}
    @php
      $cyclesPayload = ($cycles ?? collect())
        ->map(function ($c) {
          return [
            'id'         => $c->id,
            'name'       => $c->name,
            'date_from'  => optional($c->date_from)->toDateString(),
            'date_to'    => optional($c->date_to)->toDateString(),
            'status'     => $c->status,      // 'open' or 'closed'
            'closed_at'  => optional($c->closed_at)->toDateString(),
            'created_at' => optional($c->created_at)->toDateString(),
          ];
        })
        ->values();
    @endphp

    <script type="application/json" id="cycles-json">
    {!! json_encode($cyclesPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}
    </script>

    <script>
      (function() {
        const el = document.getElementById('cycles-json');
        try {
          window._cycles = JSON.parse(el?.textContent || '[]');
        } catch {
          window._cycles = [];
        }
      })();
    </script>

    <script>
      (function() {
        $.ajaxSetup({
          headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
          }
        });

        const CYCLES_STORE_URL = "{{ route('cycles.store') }}";
        const KPIS_URL = "{{ route('cycles.kpis') }}";

        const fmtAED = v => 'AED ' + (Number(v) || 0).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        const safe = s => (s ?? '').toString();

        // NEW: small escape helper (replaces _.escape)
        function esc(s) {
          return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function fetchAllKpis(ids) {
          if (!ids.length) return $.Deferred().resolve({}).promise();
          const qs = 'ids=' + ids.map(String).map(encodeURIComponent).join(',');
          return $.getJSON(KPIS_URL + '?' + qs)
            .fail((xhr) => {
              console.error('KPIs fetch failed', xhr?.status, xhr?.responseText);
            });
        }

        // Date helpers
        function safeParseDate(isoLike) {
          const s = (isoLike ?? '').toString().trim();
          if (!s) return null;
          // If it already contains a time separator, use as-is; else add midnight
          const candidate = s.includes('T') ? s : `${s}T00:00:00`;
          const d = new Date(candidate);
          return isNaN(d.getTime()) ? null : d;
        }

        // "Wed 17 Sep 2025" (or — if invalid/empty)
        function fmtDateShort(isoLike) {
          const d = safeParseDate(isoLike);
          if (!d) return '—';
          return new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }).format(d).replace(/,/g, '');
        }

        function fmtRange(fromIso, toIso) {
          return `${fmtDateShort(fromIso)} — ${fmtDateShort(toIso)}`;
        }

        function upsertCycleInMemory(updated) {
          if (!updated || !updated.id) return;
          const i = (window._cycles || []).findIndex(c => Number(c.id) === Number(updated.id));
          if (i >= 0) {
            window._cycles[i] = { ...window._cycles[i], ...updated }; // merge
          } else {
            window._cycles.push(updated);
          }
        }

        function renderCard(set, kpis) {
          const id = set.id;
          const name = set.name || `#${id}`;
          const from = set.date_from || null;
          const to = set.date_to || null;
          const isOpen = String(set.status || 'open').toLowerCase() === 'open';
          const headerBg   = isOpen ? 'from-green-200 to-green-300' : 'from-red-200 to-red-300';
          const headerText = isOpen ? 'text-green-900' : 'text-red-900';
          const badgeRing  = isOpen
            ? 'bg-green-600/10 text-green-700 ring-1 ring-inset ring-green-600/20'
            : 'bg-red-600/10 text-red-700 ring-1 ring-inset ring-red-600/20';
          const badgeDot   = isOpen ? 'bg-green-500' : 'bg-red-500';

          const closeBtnCl  = 'px-3 py-1.5 rounded text-white text-sm ' + (isOpen ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700');
          const openBtnCl   = 'px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-black text-sm';

          const data = kpis[id] || {
            cash_in: 0,
            cash_out: 0,
            profit: 0,
            us_total: 0
          };

          const openUrl = (window.OPEN_INVEST_URL_TMPL || '/c/ID_PLACEHOLDER/investments')
            .replace('ID_PLACEHOLDER', String(id)) + '?tab=summary';

          const $card = $(`
          <div class="rounded-2xl border bg-white shadow-sm p-0 overflow-hidden">
            <!-- header strip with status-based gradient -->
            <div class="px-5 py-4 bg-gradient-to-r ${headerBg} border-b flex items-center justify-between">
              <div class="space-y-0.5 ${headerText}">
                <div class="text-base md:text-lg font-semibold">${esc(name)}</div>
                <div class="text-sm md:text-base opacity-80">${fmtRange(from, to)}</div>
              </div>
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full ${badgeRing} uppercase tracking-wide">
                  <span class="inline-block h-2 w-2 rounded-full ${badgeDot}"></span>
                  ${isOpen ? 'Open' : 'Closed'}
                </span>
                ${set.closed_at ? `<span class="hidden md:inline text-xs text-gray-600">Last date: ${set.closed_at}</span>` : ''}
              </div>
            </div>

            <!-- actions -->
            <div class="px-5 pt-4 flex items-center justify-between">
              <div class="text-sm text-gray-500">Set #${id}</div>
              <div class="flex items-center gap-2">
                <a href="${openUrl}" class="${openBtnCl}">Open screen</a>
                ${isOpen
                  ? `<button class="closeSetBtn ${closeBtnCl}" data-id="${id}">Close</button>`
                  : `<button class="reopenSetBtn ${closeBtnCl}" data-id="${id}">Reopen</button>`}
              </div>
            </div>

            <!-- KPIs: force 2×2 grid on all breakpoints -->
            <div class="p-5 grid grid-cols-2 gap-3">
              <div class="rounded-xl border p-3">
                <div class="text-xs text-gray-500">Cash In</div>
                <div class="mt-0.5 font-semibold text-blue-700 text-base md:text-lg">${fmtAED(data.cash_in)}</div>
              </div>
              <div class="rounded-xl border p-3">
                <div class="text-xs text-gray-500">Cash Out</div>
                <div class="mt-0.5 font-semibold text-rose-700 text-base md:text-lg">${fmtAED(data.cash_out)}</div>
              </div>
              <div class="rounded-xl border p-3">
                <div class="text-xs text-gray-500">Profit</div>
                <div class="mt-0.5 font-semibold text-indigo-700 text-base md:text-lg">${fmtAED(data.profit)}</div>
              </div>
              <div class="rounded-xl border p-3">
                <div class="text-xs text-gray-500">US Client Payment</div>
                <div class="mt-0.5 font-semibold text-emerald-700 text-base md:text-lg">${fmtAED(data.us_total)}</div>
                <div class="mt-1 text-xs text-gray-600">
                  ${data.us_last_date
                    ? `Last: ${fmtAED(data.us_last_amount)} • ${fmtDateShort(data.us_last_date)}`
                    : 'Last: —'}
                </div>
              </div>
            </div>
          </div>
        `);

          $card.on('click', '.closeSetBtn', function() {
            const cid = $(this).data('id');
            if (!confirm('Close this set? You can reopen later.')) return;

            $.post(`/cycles/${cid}/close`)
              .done(res => {
                if (res && res.cycle) {
                  upsertCycleInMemory(res.cycle);   // status='closed', date_to set by server
                } else {
                  // Fallback: patch locally if backend didn’t return the row
                  const i = window._cycles.findIndex(c => Number(c.id) === Number(cid));
                  if (i >= 0) {
                    window._cycles[i].status = 'closed';
                    window._cycles[i].date_to = new Date().toISOString().slice(0,10);
                  }
                }
                initGrid(); // re-render immediately (no page reload)
              })
              .fail(xhr => {
                alert('Failed to close set.');
                console.error(xhr?.responseText || xhr);
              });
          });

          $card.on('click', '.reopenSetBtn', function() {
            const cid = $(this).data('id');

            $.post(`/cycles/${cid}/reopen`)
              .done(res => {
                if (res && res.cycle) {
                  upsertCycleInMemory(res.cycle);   // status='open', date_to=null
                } else {
                  const i = window._cycles.findIndex(c => Number(c.id) === Number(cid));
                  if (i >= 0) {
                    window._cycles[i].status = 'open';
                    window._cycles[i].date_to = null;
                    window._cycles[i].closed_at = null;
                  }
                }
                initGrid();
              })
              .fail(xhr => {
                alert('Failed to reopen set.');
                console.error(xhr?.responseText || xhr);
              });
          });

          return $card;
        }

        function showGridMessage(html) {
          const msg = `<div class="col-span-2 text-center text-gray-500 py-6">${html}</div>`;
          $('#cycleGrid').html(msg);
        }

        function initGrid() {
          const $grid = $('#cycleGrid').empty();

          // Basic loading state
          showGridMessage('Loading…');

          const list = Array.isArray(window._cycles) ? window._cycles.slice() : [];
          list.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
          const ids = list.map(x => x.id);

          fetchAllKpis(ids).done(kpis => {
            $grid.empty();
            if (!list.length) {
              showGridMessage('No sets yet.');
              return;
            }
            list.forEach(set => $grid.append(renderCard(set, kpis)));
          }).fail(() => {
            // Friendly error + retry
            $grid.html(`
              <div class="col-span-2 text-center py-8">
                <div class="text-gray-500 mb-3">Couldn’t load KPIs.</div>
                <button id="retryKpisBtn" class="px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-black text-sm">
                  Try again
                </button>
              </div>
            `);
            $grid.on('click', '#retryKpisBtn', initGrid);
          });
        }

        // Modal wiring
        $('#openCreateSetBtn').on('click', () => $('#createSetModal').removeClass('hidden').addClass('flex'));

        function closeModal() {
          $('#createSetModal').addClass('hidden').removeClass('flex');
          $('#createSetForm')[0].reset();
        }
        $('#closeCreateSetModal, #cancelCreateSetBtn').on('click', closeModal);

        // Create & Open
        $('#createSetForm').on('submit', function(e) {
          e.preventDefault();
          const fd = new FormData(this);
          $.ajax({
              url: CYCLES_STORE_URL,
              method: 'POST',
              data: fd,
              processData: false,
              contentType: false
            })
            .done(res => {
              const id = res?.id || res?.cycle?.id;
              if (id) {
                const openUrl = (window.OPEN_INVEST_URL_TMPL || '/c/ID_PLACEHOLDER/investments')
                  .replace('ID_PLACEHOLDER', String(id));
                location.href = openUrl;
                return;
              }
              closeModal();
              initGrid(); // refresh grid if backend didn’t redirect
            })
            .fail(xhr => {
              alert('Create failed');
              console.error(xhr?.responseText || xhr);
            });
        });

        // Boot
        $(initGrid);
      })();
    </script>
  </div>

</body>

</html>