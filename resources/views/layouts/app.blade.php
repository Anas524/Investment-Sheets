<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GTS Investment</title>
    <link rel="icon" href="{{ asset('images/GTS-web-logo.png') }}">
    <link rel="stylesheet" href="{{ asset('sheets.css') }}">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <!-- Bootstrap 5 JS Bundle (includes Popper for tooltips) -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <meta name="csrf-token" content="{{ csrf_token() }}">
</head>

<body class="p-0">

    <!-- HEADER - Show only ONCE here -->
    <div class="header">
        <div style="position: relative;">

            <div class="header-left">
                <img id="headerIcon" src="{{ asset('images/sub-logo.png') }}" alt="Sub Logo">
                <h1 id="headerTitle">GTS Investment</h1>
            </div>
        </div>
        <div class="header-right">
            <img id="headerLogo" src="{{ asset('images/gts-logo.png') }}" alt="Main Logo">
        </div>
    </div>

    <!-- SIDEBAR -->
    <div class="offcanvas offcanvas-start" tabindex="-1" id="sideMenu" aria-labelledby="sideMenuLabel">
        <div class="offcanvas-header">
            <h5 class="offcanvas-title" id="sideMenuLabel">Menu</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body">
            <button id="closeSheetBtn" class="btn btn-warning w-100 mb-3">Close Sheet</button>
            <button id="openSheetBtn" class="btn btn-success w-100 mb-3">Reopen Sheet</button>
            <button id="downloadExcelBtn" class="btn btn-success w-100">
                <img src="https://img.icons8.com/color/24/microsoft-excel-2019--v1.png" alt="Excel Icon" />
                Download Excel
            </button>
        </div>
    </div>

    <!-- MAIN DYNAMIC SECTION -->
    <div class="container-fluid">
        @yield('content')
    </div>

    <!-- Bottom Sheet Tabs (Global) -->
    <div class="bottom-tabs fixed-bottom bg-white shadow text-center d-flex justify-content-center border-top mt-5">

        <div id="customToggle" class="custom-toggle-inside" data-bs-toggle="tooltip" data-bs-placement="right" title="Menu">
            <div class="bar full-bar"></div>
            <div class="bar half-bar"></div>
        </div>

        <div class="tabs-wrapper d-flex justify-content-center flex-grow-1">
            <button class="btn sheet-tab rounded-top active" data-sheet="summary">Summary Sheet</button>
            <button class="btn sheet-tab rounded-top" data-sheet="gts">GTS Investment</button>
            <button class="btn sheet-tab rounded-top" data-sheet="us">US Client Payment</button>
            <button class="btn sheet-tab rounded-top" data-sheet="sq">SQ Sheet</button>
            <button class="btn sheet-tab rounded-top" data-sheet="local">Local Sales</button>
            <button class="btn sheet-tab rounded-top" data-sheet="rh">RH Sheet</button>
            <button class="btn sheet-tab rounded-top" data-sheet="ff">FF Sheet</button>
            <button class="btn sheet-tab rounded-top" data-sheet="bl">BL Sheet</button>
            <button class="btn sheet-tab rounded-top" data-sheet="ws">WS Sheet</button>
        </div>
    </div>

    <!-- SCRIPTS -->
    <script src="{{ asset('sheets.js') }}"></script>
    <script src="{{ asset('js/html2pdf.bundle.min.js') }}"></script>

</body>

</html>