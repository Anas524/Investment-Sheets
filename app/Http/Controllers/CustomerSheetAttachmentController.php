<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CustomerSheetEntry;
use App\Models\CustomerSheetAttachment;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;

class CustomerSheetAttachmentController extends Controller
{
    public function index(CustomerSheetEntry $entry)
    {
        return response()->json([
            'attachments' => $entry->attachments()->orderByDesc('id')
                ->get(['id', 'type', 'original_name', 'path', 'mime', 'size', 'created_at'])
        ]);
    }

    public function store(Request $request, CustomerSheetEntry $entry)
    {
        $request->validate([
            'files.*' => 'required|file|max:20480', // 20MB
            'type'    => 'nullable|string|max:32'
        ]);

        $type = strtolower(trim((string) $request->input('type')));
        if (!in_array($type, ['invoice', 'receipt', 'note'], true)) {
            $type = 'other';
        }

        foreach ((array) $request->file('files', []) as $file) {
            $path = $file->store("attachments/customer/{$entry->id}", 'public');
            CustomerSheetAttachment::create([
                'entry_id'      => $entry->id,
                'type'          => $request->type,
                'original_name' => $file->getClientOriginalName(),
                'path'          => $path,
                'mime'          => $file->getMimeType(),
                'size'          => $file->getSize(),
            ]);
        }
        return response()->json(['ok' => true]);
    }

    public function destroy($id)
    {
        $a = CustomerSheetAttachment::findOrFail($id);
        if ($a->path && Storage::disk('public')->exists($a->path)) {
            Storage::disk('public')->delete($a->path);
        }
        $a->delete();
        return response()->json(['ok' => true]);
    }

    public function downloadAll(CustomerSheetEntry $entry)
    {
        // Only this entry’s files
        $atts = $entry->attachments()
            ->orderBy('id')
            ->get(['type', 'original_name', 'path']);

        $esc = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');

        // Title (Supplier • Description • Date)
        $bits  = array_filter([$entry->supplier ?? null, $entry->description ?? null, $entry->date ?? null]);
        $title = $bits ? implode(' • ', $bits) : 'Customer Sheet Attachments';

        // ------- HTML (links only, no <img>) -------
        $html = '
    <meta charset="utf-8"/>
    <style>
      body{font-family: DejaVu Sans, sans-serif; color:#222}
      h1{font-size:20px; text-align:center; margin:0 0 6px}
      h2{font-size:13px; text-align:center; margin:0 0 18px; color:#666}
      .row{page-break-inside:avoid; margin:18px 0; padding-bottom:12px; border-bottom:1px solid #eee}
      .meta{font-size:12px; color:#444; margin-bottom:8px}
      .pill{display:inline-block; padding:4px 8px; font-size:11px; color:#fff; border-radius:999px; margin-right:6px}
      .invoice{background:#2563eb} .receipt{background:#16a34a} .note{background:#f97316} .other{background:#64748b}

      .linkbox{background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px;
               padding:10px 12px; font-size:12px}
      .linkbox a{color:#2563eb; text-decoration:none; word-break:break-all}
    </style>';

        $html .= '<h1>' . $esc($title) . '</h1>';
        $html .= '<h2>Entry #' . $esc($entry->id) . '</h2>';

        if ($atts->isEmpty()) {
            $html .= '<div class="meta">No attachments for this entry.</div>';
        } else {
            foreach ($atts as $a) {
                $type = strtolower($a->type ?? 'other');
                $pill = in_array($type, ['invoice', 'receipt', 'note']) ? $type : 'other';

                $html .= '<div class="row">';
                $html .=   '<div class="meta"><span class="pill ' . $pill . '">' . ucfirst($esc($type)) . '</span> ' . $esc($a->original_name ?: 'file') . '</div>';

                // Public URL (storage symlink assumed)
                if ($a->path && Storage::disk("public")->exists($a->path)) {
                    $url = asset('storage/' . $a->path);
                    $html .= '<div class="linkbox">Image available at:<br><a href="' . $esc($url) . '">' . $esc($url) . '</a></div>';
                } else {
                    $html .= '<div class="linkbox">File missing on disk: ' . $esc($a->path) . '</div>';
                }

                $html .= '</div>';
            }
        }

        // DomPDF – no images fetched, so no GD needed.
        return Pdf::loadHTML($html)
            ->setPaper('a4', 'portrait')
            // optional, safe to leave: allows clickable links if DomPDF needs remote
            ->set_option('isRemoteEnabled', true)
            ->download('customer_attachments_' . $entry->id . '.pdf');
    }
}
