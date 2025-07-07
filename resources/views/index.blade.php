@extends('layouts.app')
@section('content')
  <!-- GTS SHEET -->
  <div id="sheet-gts" class="sheet-section" style="display: none;">
    @include('sheets.investment')
  </div>

  <!-- US CLIENT PAYMENT SHEET -->
  <div id="sheet-us" class="sheet-section" style="display: none;">
    @include('sheets.us_client_payment')
  </div>

  <!-- SQ SHEET -->
  <div id="sheet-sq" class="sheet-section" style="display: none;">
    @include('sheets.sq_sheet')
  </div>

  <!-- RH SHEET -->
  <div id="sheet-rh" class="sheet-section" style="display: none;">
    @include('sheets.rh_sheet')
  </div>

  <!-- FF SHEET -->
  <div id="sheet-ff" class="sheet-section" style="display: none;">
    @include('sheets.ff_sheet')
  </div>

  <!-- BL SHEET -->
  <div id="sheet-bl" class="sheet-section" style="display: none;">
    @include('sheets.bl_sheet')
  </div>

  <!-- WS SHEET -->
  <div id="sheet-ws" class="sheet-section" style="display: none;">
    @include('sheets.ws_sheet')
  </div>

  <!-- Local Sales SHEET -->
  <div id="sheet-local" class="sheet-section" style="display: none;">
    @include('sheets.local_sales_sheet')
  </div>

  <!-- Summary SHEET -->
  <div id="sheet-summary" class="sheet-section" style="display: none;">
    @include('sheets.summary')
  </div>

@endsection