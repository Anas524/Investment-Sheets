<?php

namespace App\Http\Controllers;

use App\Models\BeneficiaryEntry;
use App\Models\BeneficiaryAttachment;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BeneficiaryAttachmentController extends Controller
{
    public function index(BeneficiaryEntry $entry)
    {
        return response()->json([
            'attachments' => $entry->attachments()->orderByDesc('id')
                ->get(['id','type','original_name','path','mime','size','created_at'])
        ]);
    }

    public function store(Request $request, BeneficiaryEntry $entry)
    {
        $request->validate([
            'files.*' => 'required|file|max:20480',
            'type'    => 'nullable|string|max:32',
        ]);

        $type = strtolower(trim((string)$request->input('type')));
        if (!in_array($type, ['invoice','receipt','note'], true)) $type = 'other';

        foreach ((array)$request->file('files', []) as $file) {
            $path = $file->store("attachments/beneficiaries/{$entry->id}", 'public');
            BeneficiaryAttachment::create([
                'entry_id'      => $entry->id,
                'type'          => $type,
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
        $a = BeneficiaryAttachment::findOrFail($id);
        if ($a->path && Storage::disk('public')->exists($a->path)) {
            Storage::disk('public')->delete($a->path);
        }
        $a->delete();
        return response()->json(['ok' => true]);
    }

    public function downloadAll(BeneficiaryEntry $entry)
    {
        $atts = $entry->attachments()->orderBy('id')->get(['type','original_name','path']);
        $esc = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');

        $title = 'Beneficiary Attachments • Entry #' . $entry->id;
        $html = '<meta charset="utf-8"/><style>
          body{font-family:DejaVu Sans,sans-serif;color:#222}
          h1{font-size:20px;text-align:center;margin:0 0 6px}
          h2{font-size:13px;text-align:center;margin:0 0 18px;color:#666}
          .row{page-break-inside:avoid;margin:18px 0;padding-bottom:12px;border-bottom:1px solid #eee}
          .meta{font-size:12px;color:#444;margin-bottom:8px}
          .pill{display:inline-block;padding:4px 8px;font-size:11px;color:#fff;border-radius:999px;margin-right:6px}
          .invoice{background:#2563eb}.receipt{background:#16a34a}.note{background:#f97316}.other{background:#64748b}
          .linkbox{background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;font-size:12px}
          .linkbox a{color:#2563eb;text-decoration:none;word-break:break-all}
        </style>';
        $html .= '<h1>'.$esc($title).'</h1><h2>'.$esc($entry->beneficiary ?? '').'</h2>';

        if ($atts->isEmpty()) {
            $html .= '<div class="meta">No attachments for this entry.</div>';
        } else {
            foreach ($atts as $a) {
                $pill = in_array(($a->type ?? 'other'), ['invoice','receipt','note']) ? $a->type : 'other';
                $html .= '<div class="row">';
                $html .= '<div class="meta"><span class="pill '.$pill.'">'.ucfirst($esc($a->type ?? 'other')).'</span> '.$esc($a->original_name ?: 'file').'</div>';
                if ($a->path && Storage::disk('public')->exists($a->path)) {
                    $url = asset('storage/'.$a->path);
                    $html .= '<div class="linkbox">File available at:<br><a href="'.$esc($url).'">'.$esc($url).'</a></div>';
                } else {
                    $html .= '<div class="linkbox">File missing on disk: '.$esc($a->path).'</div>';
                }
                $html .= '</div>';
            }
        }

        return Pdf::loadHTML($html)->setPaper('a4','portrait')->set_option('isRemoteEnabled', true)
            ->download('beneficiary_attachments_'.$entry->id.'.pdf');
    }
}
