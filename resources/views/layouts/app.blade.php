<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GTS Investment</title>
    <link rel="icon" href="{{ asset('images/GTS-web-logo.png') }}">
    <link rel="stylesheet" href="{{ asset('tailwind.css') }}">
    <!-- <link rel="stylesheet" href="{{ asset('sheets.css') }}"> -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
    <!-- Tailwind CSS CDN -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/tippy.js@6/themes/light.css" />
    <script src="https://unpkg.com/@popperjs/core@2"></script>
    <script src="https://unpkg.com/tippy.js@6"></script>
    <!-- jQuery and other libraries -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script id="apexcharts-cdn" src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
    <meta name="csrf-token" content="{{ csrf_token() }}">
</head>

<body class="bg-gray-100 text-gray-800 cursor-default">

    <!-- HEADER - Show only ONCE here -->
    <header class="flex items-center justify-between p-4 bg-white shadow">
        <div class="flex items-end space-x-2">
            <img id="headerIcon" src="{{ asset('images/sub-logo.png') }}" alt="Sub Logo" class="h-6">
            <h1 id="headerTitle" class="text-xl font-semibold">GTS Investment</h1>
        </div>
        <div>
            <img id="headerLogo" src="{{ asset('images/gts-logo.png') }}" alt="Main Logo" class="h-20">
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
        window.routes = Object.assign({}, window.routes || {}, {
            updateCustomerEntry: "{{ route('customer.entry.update') }}",
            loanOutstanding: "{{ route('summary.customerSheets.loans') }}",
            loanLedgerIndex: "/customer-sheet/:sheetId/loan-ledger",
            loanLedgerStore: "/customer-sheet/:sheetId/loan-ledger",
            loanLedgerUpdate: "/customer-sheet/loan-ledger/:id",
            loanLedgerDestroy: "/customer-sheet/loan-ledger/:id",
        });
    </script>

    <!-- SCRIPTS -->
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