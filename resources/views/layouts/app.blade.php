@php
    // Global flag: available to all sections/partials that extend this layout
    $isClosed = isset($cycle) && ($cycle->status ?? null) === 'closed';
@endphp

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GTS Investment</title>
    <link rel="icon" href="{{ asset('images/GTS-web-logo.png') }}">
    <!-- Fonts & Icons -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <!-- Tailwind CSS CDN -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
    <script src="https://cdn.tailwindcss.com"></script>

    <link rel="stylesheet" href="{{ asset('tailwind.css') }}">
    <link rel="stylesheet" href="https://unpkg.com/tippy.js@6/themes/light.css" />
    <script src="https://unpkg.com/@popperjs/core@2"></script>
    <script src="https://unpkg.com/tippy.js@6"></script>
    <!-- jQuery and other libraries -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script id="apexcharts-cdn" src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @php $activeMetaId = isset($cycle) ? $cycle->id : (session('active_cycle_id') ?? request('cycle_id')); @endphp
    <meta name="active-cycle-id" content="{{ $activeMetaId }}">
</head>

<body class="bg-gray-100 text-gray-800 cursor-default">

    @if(isset($cycle) && $cycle->status === 'closed')
    <div id="cycle-closed-banner"
        class="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm text-center py-2">
        This set is <strong>CLOSED</strong>. Reopen or create a new set to make changes.
    </div>
    <style>
        body {
            padding-top: 40px;
        }
    </style>
    <script>
        document.documentElement.classList.add('is-cycle-closed');
        window.__SET_IS_CLOSED = true;
    </script>
    @else
    <script>
        window.__SET_IS_CLOSED = false;
    </script>
    @endif

    <!-- HEADER - Show only ONCE here -->
    <header class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 py-4 grid grid-cols-3 items-center">
            <!-- Left: icon + title + status -->
            <div class="flex items-end space-x-2">
                <img id="headerIcon" src="{{ asset('images/sub-logo.png') }}" alt="Sub Logo" class="h-6">
                <h1 id="headerTitle" class="text-xl font-semibold">GTS Investment</h1>

                @isset($cycle)
                <span class="ml-2 px-2 py-0.5 text-xs rounded
                        {{ $cycle->status === 'closed' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700' }}">
                    {{ strtoupper($cycle->status) }}
                </span>
                @endisset
            </div>

            <!-- Center: Dashboard button -->
            <div class="flex justify-center">
                <a href="{{ route('cycles.index') }}"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black shadow-sm allow-when-closed">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                    </svg>
                    <span>Dashboard</span>
                </a>
            </div>

            <!-- Right: set info + logo -->
            <div class="flex items-center justify-end gap-3">
                @isset($cycle)
                <div class="text-right leading-tight text-xs text-gray-600">
                    {{ $cycle->name ?? 'Set' }}
                    @if($cycle->date_from || $cycle->date_to)
                    • {{ optional($cycle->date_from)->toDateString() ?? '—' }}
                    – {{ optional($cycle->date_to)->toDateString() ?? '—' }}
                    @endif
                </div>
                @endisset

                <img id="headerLogo" src="{{ asset('images/gts-logo.png') }}" alt="Main Logo" class="h-16 md:h-20">
            </div>
        </div>
    </header>

    <!-- makes the update URL available even if inline scripts are blocked -->
    <div id="customer-sheet-root"
        data-update-url="{{ route('customer.entry.update') }}"
        hidden>
    </div>

    <!-- MAIN DYNAMIC SECTION -->
    <main class="container mx-auto p-4">
        @yield('content')
    </main>

    <!-- Dynamic Customer Sheets will appear here -->
    <div id="sheetContainer" class="max-w-screen-xl mx-auto p-4 space-y-6">
        @if(isset($sheetName) && isset($sheetId))
        @include('sheets.customer_sheet', ['sheetId' => $sheetId, 'sheetName' => $sheetName])
        @endif
    </div>

    <!-- Bottom Sheet Tabs (Global) -->
    <div class="fixed bottom-0 inset-x-0 bg-white shadow border-t flex justify-center space-x-1 z-50">
        <button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100 active" data-sheet="summary">Summary Sheet</button>
        <button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100" data-sheet="beneficiary">Beneficiary Sheet</button>
        <button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100" data-sheet="gts-material">GTS Materials</button>
        <button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100" data-sheet="gts-investment">GTS Investments</button>
        <button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100" data-sheet="us">US Client Payment</button>
        <button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100" data-sheet="sq">SQ Sheet</button>
        <button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100" data-sheet="local">Local Sales</button>

        <!-- Dynamic Customer Sheets -->
        <span id="customerTabsContainer" class="relative"></span>
    </div>

    <script>
        window.addEventListener('load', function() {
            if (window.refreshAllTotals) {
                // fetch material + shipping (from /gts-materials/total) and
                // investment (from /gts-investments/total), then paint the three cards
                window.refreshAllTotals();
            }
        });
    </script>

    <script>
        window.routes = Object.assign({}, window.routes || {}, {
            updateCustomerEntry: "{{ route('customer.entry.update') }}",
            loanOutstanding: "{{ route('summary.customerSheets.loans') }}",
            loanLedgerIndex: "/customer-sheet/:sheetId/loan-ledger",
            loanLedgerStore: "/customer-sheet/:sheetId/loan-ledger",
            loanLedgerUpdate: "/customer-sheet/loan-ledger/:id",
            loanLedgerDestroy: "/customer-sheet/loan-ledger/:id",
        });
    </script>

    <script type="application/json" id="cycle-json">
    {!! json_encode(
        isset($cycle) ? [
            'id'        => $cycle->id ?? null,
            'name'      => $cycle->name ?? null,
            'status'    => $cycle->status ?? null,
            'date_from' => optional($cycle->date_from)->toDateString(),
            'date_to'   => optional($cycle->date_to)->toDateString(),
        ] : null,
        JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    ) !!}
    </script>

    <script>
        (function() {
            var el = document.getElementById('cycle-json');
            try {
                window.cycle = JSON.parse(el.textContent || 'null');
            } catch (_) {
                window.cycle = null;
            }

            if (window.cycle && window.cycle.status === 'closed') {
                document.documentElement.classList.add('is-cycle-closed');
            }

            function norm(p) {
                p = String(p || '');
                return p[0] === '/' ? p : '/' + p;
            }
            // Attach ?cycle_id=ID (query-param style)
            window.withCycle = (function() {
                function norm(p) {
                    p = String(p || '');
                    return p[0] === '/' ? p : '/' + p;
                }
                return function(p) {
                    // prefer server-provided cycle.id; else fall back to window.activeCycleId
                    var id = (window.cycle && window.cycle.id) ||
                        (typeof window.activeCycleId !== 'undefined' ? window.activeCycleId : 0) || 0;
                    p = norm(p);
                    return id ? `${p}${p.includes('?') ? '&' : '?'}cycle_id=${id}` : p;
                };
            })();

            window.investmentUrl = function(s) {
                return window.withCycle(s);
            };
            window.ensureOpenOrToast = function() {
                if (window.cycle && window.cycle.status === 'closed') {
                    alert('This set is closed. Reopen or create a new set.');
                    return false;
                }
                return true;
            };
        })();
    </script>

    <!-- 2) UX polish: visually lock writes + global 403 toast -->
    <script>
        $(function() {
            if (window.cycle && window.cycle.status === 'closed') {
                $('[data-write]').attr('aria-disabled', 'true');

                // safety net: tag common write controls if not already annotated
                $('.submit-investment-btn, .invest-save-changes-btn, .update-invest-btn, .delete-investment-btn, #saveMurabahaDateBtn')
                    .attr('data-write', '');
                $('#attachmentUploadForm button[type=submit], #attachmentUploadForm input[type=file]').attr('data-write', '');

                // global toast on forbidden writes
                $(document).ajaxError(function(_e, xhr) {
                    if (xhr && xhr.status === 403) alert('This set is closed. Reopen or create a new set to make changes.');
                });
            }
        });
    </script>

    <script>
        // Prefer the server-provided session cycle, fallback to ?cycle_id
        (function() {
            var meta = document.querySelector('meta[name="active-cycle-id"]');
            var fromMeta = meta && meta.content ? Number(meta.content) : 0;
            var fromQS = Number(new URLSearchParams(location.search).get('cycle_id') || 0);
            window.activeCycleId = fromMeta || fromQS || 0;
        })();
    </script>

    <script type="application/json" id="customer-sheets-json">
        @json($customerSheetsForJs)
    </script>

    <script>
        (function() {
            var el = document.getElementById('customer-sheets-json');
            try {
                window.customerSheetsFromServer = JSON.parse(el.textContent || '[]');
            } catch (_) {
                window.customerSheetsFromServer = [];
            }
        })();
    </script>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            var list = window.customerSheetsFromServer || [];
            if (!Array.isArray(list) || list.length === 0) return; // nothing to add
            list.forEach(s => addCustomerSheetUI({
                id: s.id,
                name: s.name
            }));
        });
    </script>

    <!-- SCRIPTS -->
    @isset($cycle)
    <script src="{{ asset('cycle-glue.js') }}"></script>
    <script src="{{ asset('gts-totals.js') }}"></script>
    @endisset

    <script src="{{ asset('sheets.js') }}"></script>
    <script src="{{ asset('dynamic.js') }}"></script>
    <script src="{{ asset('customer_sheet.js') }}"></script>
    <script src="{{ asset('js/html2pdf.bundle.min.js') }}"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    @yield('scripts')

    @hasSection('customerSheets')
    @yield('customerSheets')
    @endif
</body>

</html>