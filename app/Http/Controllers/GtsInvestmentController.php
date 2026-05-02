<?php

namespace App\Http\Controllers;

use App\Models\GtsInvestment;
use App\Models\Cycle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Support\ActiveCycle;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class GtsInvestmentController extends Controller
{
    private function findInActiveCycleOrFail(Request $request, $id): GtsInvestment
    {
        $c = ActiveCycle::id($request);
        return GtsInvestment::where('id', $id)
            ->where('cycle_id', $c)
            ->firstOrFail();
    }

    public function index(Request $request)
    {
        $c = ActiveCycle::id($request);
        $investments = GtsInvestment::where('cycle_id', $c)
            ->orderBy('created_at', 'asc')
            ->get();
        return response()->json($investments);
    }

    public function store(Request $request)
    {
        try {
            $c = ActiveCycle::id($request);

            $investment = GtsInvestment::create([
                'cycle_id'           => $c,
                'date' => $request->date,
                'investor' => $request->investor,
                'investment_amount' => $request->investment_amount ?? 0,
                'investment_no' => $request->investment_no ?: null,
                'mode_of_transaction' => $request->mode_of_transaction ?: null,
                'murabaha' => $request->murabaha ?: null,
                'repayment_terms' => $request->repayment_terms ?: null,
                'loan_tenure' => $request->loan_tenure !== '' ? (int)$request->loan_tenure : null,
                'repayment_date' => $request->repayment_date ?: null,
                'remarks' => $request->remarks ?: null,
                'status' => 'saved',
                'payment_method' => $request->payment_method ?: null,
            ]);

            return response()->json($investment);
        } catch (\Throwable $e) {
            Log::error('Investment Save Error', ['message' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $inv = $this->findInActiveCycleOrFail($request, $id);

        // accept strings; Eloquent cast will normalize to 7-dp string on output
        $inv->update([
            'date'               => $request->date,
            'investor'           => $request->investor,
            'investment_amount'  => $request->investment_amount ?? 0, // keep as numeric-ish string
            'investment_no'      => $request->investment_no ?: null,
            'mode_of_transaction' => $request->mode_of_transaction ?: null,
            'murabaha'           => $request->murabaha ?: null,
            'repayment_terms'    => $request->repayment_terms ?: null,
            'loan_tenure'        => ($request->loan_tenure !== '') ? (int)$request->loan_tenure : null,
            'repayment_date'     => $request->repayment_date ?: null,
            'remarks'            => $request->remarks ?: null,
            'payment_method'     => $request->payment_method ?: null,
            'murabaha_status'    => $request->murabaha_status ?: 'no',
            'murabaha_date'      => $request->murabaha_date ?: null,
        ]);

        return response()->json(['ok' => true]);
    }

    public function finalize(Request $request, $id)
    {
        $investment = $this->findInActiveCycleOrFail($request, $id);
        $investment->is_finalized = true;
        $investment->save();

        return response()->json(['message' => 'Investment finalized successfully.']);
    }

    public function destroy(Request $request, $id)
    {
        $investment = $this->findInActiveCycleOrFail($request, $id);
        $investment->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function getTotalAmount(Request $request)
    {
        $c = ActiveCycle::id($request);

        if (!Schema::hasTable('gts_investments')) {
            return response()->json(['total' => '0.0000000']);
        }

        // Pick the correct column name safely
        $col = collect(['investment_amount', 'amount'])
            ->first(fn($cname) => Schema::hasColumn('gts_investments', $cname));

        if (!$col) {
            return response()->json([
                'total' => '0.0000000',
                '_warn' => 'No amount column found on gts_investments (expected investment_amount or amount)',
            ]);
        }

        $q = DB::table('gts_investments as i')
            ->where('i.cycle_id', $c);

        // soft/flags (optional but safer)
        if (Schema::hasColumn('gts_investments', 'deleted_at')) {
            $q->whereNull('i.deleted_at');
        }
        foreach (['deleted', 'is_deleted', 'archived'] as $f) {
            if (Schema::hasColumn('gts_investments', $f)) {
                $q->where("i.$f", 0);
            }
        }

        // sum in SQL as DECIMAL and round to 7 dp
        $sum = $q->selectRaw("ROUND(SUM(COALESCE(i.$col, 0)), 7) as s")->value('s');

        // return as string to avoid float drift
        $total = number_format((float)($sum ?? 0), 7, '.', '');

        return response()->json(['total' => $total]);
    }

    public function uploadAttachments(Request $request, $id)
    {
        $investment = $this->findInActiveCycleOrFail($request, $id);

        // Delete old invoice if new one uploaded
        if ($request->hasFile('invoice')) {
            if ($investment->invoice && Storage::disk('public')->exists($investment->invoice)) {
                Storage::disk('public')->delete($investment->invoice);
            }
            $path = $request->file('invoice')->store('attachments/investment/invoice', 'public');
            $investment->invoice = $path;
        }

        // Delete old receipt if new one uploaded
        if ($request->hasFile('receipt')) {
            if ($investment->receipt && Storage::disk('public')->exists($investment->receipt)) {
                Storage::disk('public')->delete($investment->receipt);
            }
            $path = $request->file('receipt')->store('attachments/investment/receipt', 'public');
            $investment->receipt = $path;
        }

        // Delete old note if new one uploaded
        if ($request->hasFile('note')) {
            if ($investment->note && Storage::disk('public')->exists($investment->note)) {
                Storage::disk('public')->delete($investment->note);
            }
            $path = $request->file('note')->store('attachments/investment/note', 'public');
            $investment->note = $path;
        }

        $investment->save();

        return response()->json(['success' => true]);
    }

    public function getAttachments(Request $request, $id)
    {
        $investment = $this->findInActiveCycleOrFail($request, $id);

        return response()->json([
            'invoice' => $investment->invoice ? asset('storage/' . $investment->invoice) : null,
            'receipt' => $investment->receipt ? asset('storage/' . $investment->receipt) : null,
            'note'    => $investment->note ? asset('storage/' . $investment->note) : null,
        ]);
    }

    public function downloadAttachments(Request $request, $id)
    {
        $investment = $this->findInActiveCycleOrFail($request, $id);

        $html = '
            <style>
                body { font-family: sans-serif; }
                h2 { text-align: center; margin-bottom: 0px; }
                .attachment-block {
                    page-break-inside: avoid;
                    margin-bottom: 30px;
                }
                .attachment-block img {
                    max-width: 100%;
                    max-height: 800px;
                    display: block;
                    margin: 0 auto;
                    object-fit: contain;
                }
            </style>
            <h2>GTS Investment Attachments</h2>
        ';

        $html .= $this->embedImageIfExists($investment->invoice, 'Invoice');
        $html .= $this->embedImageIfExists($investment->receipt, 'Receipt');
        $html .= $this->embedImageIfExists($investment->note, 'Delivery Note');

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->setPaper('a4', 'portrait');
        return $pdf->download("investment_attachments_{$id}.pdf");
    }

    private function embedImageIfExists($path, $title)
    {
        if (!$path || !Storage::disk('public')->exists($path)) return '';

        $fullPath = Storage::disk('public')->path($path);
        $ext = pathinfo($fullPath, PATHINFO_EXTENSION);
        $data = file_get_contents($fullPath);
        $base64 = 'data:image/' . $ext . ';base64,' . base64_encode($data);

        return "
            <div class='attachment-block'>
                <h3>$title</h3>
                <img src='$base64' alt='$title Attachment'>
            </div>
        ";
    }

    public function updateMurabaha(Request $request, $id)
    {
        $investment = $this->findInActiveCycleOrFail($request, $id);

        $investment->murabaha_status = $request->murabaha_status;
        $investment->murabaha_date = $request->murabaha_date;
        $investment->save();

        return response()->json(['success' => true]);
    }
}
