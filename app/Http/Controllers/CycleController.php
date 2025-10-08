<?php

namespace App\Http\Controllers;

use App\Models\Cycle;
use App\Models\USClient;
use App\Services\CycleMetricService;
use Illuminate\Http\Request;

class CycleController extends Controller
{
    public function __construct(private CycleMetricService $metrics) {}

    public function index()
    {
        $cycles = Cycle::orderByDesc('id')->get();
        return view('cycles.index', compact('cycles'));
    }

    public function kpis(Request $request)
    {
        $ids = collect(explode(',', (string) $request->query('ids')))
            ->filter()->map(fn($v) => (int)$v)->unique()->values();

        if ($ids->isEmpty()) {
            return response()->json([]);
        }

        $out = [];
        foreach ($ids as $id) {
            // your existing totals
            $snap = $this->metrics->computeFor($id);

            // NEW: latest US Client payment for this cycle
            $last = USClient::where('cycle_id', $id)
                ->orderByDesc('date')->orderByDesc('id')->first();

            $snap['us_last_amount'] = (float) ($last->amount ?? 0);
            // if 'date' is a Carbon date column this yields "YYYY-MM-DD"
            $snap['us_last_date']   = optional(optional($last)->date)->toDateString()
                                   ?? ($last->date ?? null);

            $out[$id] = $snap;
        }

        return response()->json($out);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'date_from' => ['nullable', 'date'],
            'date_to'   => ['nullable', 'date'],
        ]);

        $data['status'] = 'open';

        $cycle = Cycle::create($data);

        // Your JS expects JSON with an id (and may redirect itself)
        if ($request->wantsJson()) {
            return response()->json(['id' => $cycle->id, 'cycle' => $cycle], 201);
        }

        // jump straight into the cycle screen
        return redirect()->route('cycles.investments.page', $cycle);
    }

    public function close(Cycle $cycle)
    {
        $cycle->update([
            'status'    => 'closed',
            'date_to'   => $cycle->date_to ?? now()->toDateString(),
            'closed_at' => now()->toDateString(),
        ]);

        // keep your metric snapshot synchronous so UI has fresh KPIs
        $this->metrics->recomputeAndPersist($cycle->id);

        $fresh = $cycle->fresh(); // reload from DB

        return response()->json([
            'ok'    => true,
            // either return all:
            // 'cycle' => $fresh,

            // or just the fields the grid needs:
            'cycle' => $fresh->only(['id', 'name', 'status', 'date_from', 'date_to', 'closed_at']),
        ]);
    }

    public function reopen(Cycle $cycle)
    {
        $cycle->update([
            'status'    => 'open',
            'date_to'   => null,
            'closed_at' => null,
        ]);

        $this->metrics->recomputeAndPersist($cycle->id);

        $fresh = $cycle->fresh();

        return response()->json([
            'ok'    => true,
            'cycle' => $fresh->only(['id', 'name', 'status', 'date_from', 'date_to', 'closed_at']),
        ]);
    }

    public function kpisDebug(Request $request)
    {
        $ids = collect(explode(',', (string) $request->query('ids')))
            ->filter()->map(fn($v) => (int)$v)->unique()->values();

        $out = [];
        foreach ($ids as $id) {
            $snap = $this->metrics->computeFor($id);
            $out[$id] = $snap; // contains cash_in/out/profit + local/sq/us/customers/material/shipping/investment
        }
        return response()->json($out);
    }
}
