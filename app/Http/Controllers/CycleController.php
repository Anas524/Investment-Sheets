<?php

namespace App\Http\Controllers;

use App\Models\Cycle;
use App\Models\USClient;
use App\Services\CycleMetricService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

class CycleController extends Controller
{
    public function __construct(private CycleMetricService $metrics) {}

    public function index()
    {
        $cycles = Cycle::orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        // Prefer OPEN book
        $openBook = DB::table('pl_books')
            ->where('is_closed', 0)
            ->orderByDesc('id')
            ->first();

        // Fallback to latest
        $latestBook = DB::table('pl_books')
            ->orderByDesc('id')
            ->first();

        $book = $openBook ?: $latestBook;

        return view('cycles.index', [
            'cycles'      => $cycles,
            'plBookId'    => $book?->id,
            'plFromMonth' => $book?->from_month,
            'plToMonth'   => $book?->to_month,
            'plIsClosed'  => (bool) ($book?->is_closed),
        ]);
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

        // --- simple de-dupe guard (prevents accidental doubles on retry) ---
        $existing = Cycle::where('name', $data['name'])
            ->whereNull('deleted_at') // ignore soft-deleted cycles
            ->first();

        if ($existing) {
            if ($request->ajax() || $request->expectsJson()) {
                return response()->json(['id' => $existing->id, 'cycle' => $existing], 200);
            }
            return $this->redirectToCycle($existing);
        }

        $cycle = Cycle::create($data);

        // --- AJAX/JSON callers (your JS) ---
        if ($request->ajax() || $request->expectsJson()) {
            return response()->json(['id' => $cycle->id, 'cycle' => $cycle], 201);
        }

        // --- Non-AJAX: redirect to the set screen ---
        return $this->redirectToCycle($cycle);
    }

    /** Keep route name differences (local vs live) out of the action logic */
    protected function redirectToCycle(Cycle $cycle)
    {
        if (Route::has('investment.cycles.investments.page')) {
            return redirect()->route('investment.cycles.investments.page', $cycle);
        }
        if (Route::has('cycles.investments.page')) {
            return redirect()->route('cycles.investments.page', $cycle);
        }
        // final fallback
        return redirect()->to("/investment/c/{$cycle->id}/investments");
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

    public function destroy(Cycle $cycle)
    {
        // soft delete (requires SoftDeletes on the model)
        $cycle->delete();

        // Return JSON for AJAX
        return response()->json(['ok' => true]);
    }
}
